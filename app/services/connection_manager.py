from collections import defaultdict  

from fastapi import WebSocket  


class ConnectionManager:  # keeps track of who is connected to which project chat
    def __init__(self):
        self.rooms: dict[int, list[WebSocket]] = defaultdict(list)  # project_id -> list of connected sockets

    async def connect(self, project_id: int, websocket: WebSocket):  # add a socket to a project's room
        await websocket.accept()  # complete the WebSocket handshake (only after auth checks passed)
        self.rooms[project_id].append(websocket)  # remember this socket under its project

    def disconnect(self, project_id: int, websocket: WebSocket):  # remove a socket when the user leaves
        if websocket in self.rooms.get(project_id, []):  # only remove if it is actually in the room
            self.rooms[project_id].remove(websocket)  # take the socket out of the room
        if not self.rooms.get(project_id):  # if the room is now empty
            self.rooms.pop(project_id, None)  # delete the room to free memory

    async def broadcast(self, project_id: int, payload: dict):  # send one message to everyone in a project
        for connection in list(self.rooms.get(project_id, [])):  # loop over a copy so removals during the loop are safe
            try:
                await connection.send_json(payload)  # send the dict as JSON text
            except Exception:  # the socket is dead or closed
                self.disconnect(project_id, connection)  # clean it up so it is not tried again


manager = ConnectionManager()  # one shared instance used by the whole app