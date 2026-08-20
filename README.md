# PeerCollab

<div align="center">

<img src="https://img.shields.io/badge/Group-07-brightgreen?style=for-the-badge" />
<img src="https://img.shields.io/badge/Course-EER4189-blue?style=for-the-badge" />
<img src="https://img.shields.io/badge/OUSL-2025%2F26-orange?style=for-the-badge" />

</div>

<br/>

> A Student Productivity & Group Project Collaboration Platform <br/>
> *Built by Students, for Students*

## About

PeerCollab is a unified web-based platform designed specifically for undergraduate students. It brings course-based personal task and note management together with group project collaboration in one place, eliminating the need to switch between multiple disconnected tools like WhatsApp, Google Docs, Trello, and email.

<hr> 

## Features

| Feature | Description |
|---|---|
| 📚 Course Management | Organise personal tasks and notes under each university course. A default General course is available for non-course-specific tasks and notes |
| ✅ Personal Task Manager | Track assignments and deadlines with priority and status under each course |
| 📝 Personal Notes | Create and manage study notes organised by course| 
| 🗂️ Group Project Workspace | Create or join projects with a unique invite code |
| 📋 Kanban Board | Manage project tasks across To Do, Doing, and Done columns |
| 👥 Members & Roles | Assign roles and manage team members within each project |
| 💬 Real-time Chat | Project-specific chat powered by WebSockets |
| 📁 File Sharing | Upload and download project files within the workspace |
| 📊 Unified Dashboard | See all tasks, deadlines, and project progress in one view |
| 🤖 AI Task Suggester | Describe your project and let AI generate a task list |
| 🔔 Notifications | Get notified when tasks are assigned, members join, or files are uploaded | 

<hr>

## Tech Stack

| Layer | Technology |
|---|---|
| Backend Framework | FastAPI (Python) |
| Database | MySQL 8.0 |
| ORM & Migrations | SQLAlchemy + Alembic |
| Authentication | JWT (python-jose + passlib bcrypt) |
| Templates | Jinja2 |
| Styling | Tailwind CSS |
| Frontend | Vanilla JavaScript |
| Drag and Drop | HTML5 Drag and Drop API |
| Real-time Chat | FastAPI WebSockets + Browser WebSocket API |
| File Storage | Local filesystem |
| AI Integration | Gemini API |
| Server | Uvicorn |

<hr>

## Project Structure

``` 

peercollab/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models/
│   ├── routers/
│   ├── schemas/
│   ├── utils/
│   └── websocket/
├── templates/
│   ├── base.html
│   ├── auth/
│   ├── dashboard/
│   ├── courses/
│   ├── projects/
│   └── profile/
├── static/
│   ├── css/
│   ├── js/
│   └── uploads/
├── uploads/
├── docs/
│   ├── meeting-minutes/
│   ├── wireframes/
│   └── diagrams/
├── requirements.txt
├── alembic.ini
├── .env.example
├── .gitignore
├── API_CONTRACT.md
├── CONTRIBUTING.md
└── README.md

```

<hr>

## Getting Started

### Prerequisites

- Python 3.11+
- MySQL 8.0
- Git

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/PeerCollab/peercollab.git
cd peercollab

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your MySQL credentials and secret key

# Create the database
mysql -u root -p -e "CREATE DATABASE peercollab_db;"

# Run database migrations
alembic upgrade head

# Start the development server
uvicorn app.main:app --reload
```

The application will be available at `http://localhost:8000`
API documentation available at `http://localhost:8000/docs`

<hr>

## Team

| Name | Role |
|---|---|
| [Asna Assalam](https://github.com/asnaassalam) | Team Lead & Full Stack Developer |
| [Hasna Marikkar](https://github.com/HasnaMarikkar) | Full Stack Developer |
| [Seema Sham](https://github.com/SeemaSham29) | Full Stack Developer |
| [Najla Masaheem](https://github.com/Najla-Nusrath) | Full Stack Developer |

<hr>

## Documentation

- [API Contract](./API_CONTRACT.md)
- [Contributing Guide](./CONTRIBUTING.md)

<hr>

*PeerCollab - EER4189 Software Design in Group | OUSL 2025/26*