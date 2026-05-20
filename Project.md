# SYSTEM ROLE & CONTEXT
You are an Expert Full-Stack & DevOps Architect. Your task is to generate a complete, production-like microservices application tailored for local development via Docker Compose. 

# PROJECT OVERVIEW: "AI-First Media Processing Pipeline"
This is a B2B platform where users upload media files, create "AI processing jobs" (mocked via timeouts), and receive asynchronous notifications upon completion. 

Crucially, this local setup must serve as a direct precursor to an AWS Fargate deployment. Therefore, cloud services will be mocked locally (e.g., MinIO for AWS S3, internal Webhooks for AWS SNS, local PostgreSQL/MongoDB for AWS RDS/DynamoDB).

# ARCHITECTURAL CONSTRAINTS
1. **Microservices:** The backend MUST be strictly divided into 4 independent Node.js/Express services.
2. **Database per Service:** Services must NOT share databases.
3. **Containerization:** Each service, including the frontend, must have its own `Dockerfile`. A root `docker-compose.yml` will orchestrate the entire system along with the necessary databases and MinIO.
4. **API Gateway:** Provide a simple NGINX configuration (or an Express-based gateway) to route frontend requests to the correct internal microservices.

---

# MICROSERVICES SPECIFICATION

## 1. Auth Service
* **Role:** Handles user registration and authentication (Local stand-in for AWS Cognito).
* **Database:** PostgreSQL (Database name: `auth_db`).
* **Endpoints Required:**
    * `POST /api/auth/register` (Registers user, returns JWT)
    * `POST /api/auth/login` (Authenticates user, returns JWT)

## 2. Job Manager Service
* **Role:** The core orchestrator. Manages processing tasks.
* **Database:** PostgreSQL (Database name: `jobs_db`).
* **Mock AI Logic:** When a job is created, set status to 'Pending', start a `setTimeout` for 10 seconds. After 10s, update status to 'Completed' and send an HTTP POST request (webhook) to the Notification Service to simulate an AWS SNS pub/sub event.
* **Endpoints Required:**
    * `POST /api/jobs` (Creates a new job with a specific `fileId` and `actionType`)
    * `GET /api/jobs` (Returns all jobs for the authenticated user)
    * `GET /api/jobs/:id` (Returns details of a specific job)

## 3. Media Service (Mandatory Multimedia Handling)
* **Role:** Handles raw file uploads and serves processed files.
* **Storage:** **MinIO** (Local stand-in for AWS S3).
* **Database:** MongoDB (Database name: `media_metadata_db` - stores file metadata like original name, minio object key, size, mimetype).
* **Endpoints Required:**
    * `POST /api/media/upload` (Accepts `multipart/form-data`, uploads to MinIO, saves metadata to Mongo, returns `fileId`)
    * `GET /api/media/:id` (Fetches metadata from Mongo, retrieves file stream from MinIO, and serves it to the client)

## 4. Notification Service
* **Role:** Stores and serves user alerts (Local stand-in for AWS SNS subscriber).
* **Database:** MongoDB (Database name: `notifications_db`).
* **Endpoints Required:**
    * `POST /api/notifications/internal` (Internal webhook endpoint called ONLY by Job Manager. Saves the notification to DB).
    * `GET /api/notifications` (Returns a list of notifications for the user to display in the UI).

---

# FRONTEND SPECIFICATION
* **Tech Stack:** React (Vite) + basic CSS or Tailwind.
* **Pages/Components Needed:**
    1.  **Login/Register:** To get the JWT.
    2.  **Dashboard:** Shows current jobs, a button to "Upload New Media", and a "Notifications" dropdown/bell icon.
    3.  **Upload Flow:** A form to select a file, upload it (hits Media Service), receive the `fileId`, and automatically trigger a new Job (hits Job Manager).
    4.  **Polling/Refresh:** The dashboard should allow the user to refresh or auto-poll to see when their job status changes to 'Completed' and a notification appears.

---

# EXPECTED DELIVERABLES & DIRECTORY STRUCTURE
Please generate the code following this exact monorepo structure:

```text
/media-pipeline-platform
├── docker-compose.yml
├── /api-gateway
│   └── nginx.conf (or express gateway code)
├── /frontend
│   ├── Dockerfile
│   ├── package.json
│   └── /src (React app code calling /api/...)
├── /services
│   ├── /auth-service
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js (along with controllers/models)
│   ├── /job-service
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js
│   ├── /media-service
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js (Must configure MinIO client)
│   └── /notification-service
│       ├── Dockerfile
│       ├── package.json
│       └── server.js
```

# IMPLEMENTATION STEPS FOR THE AGENT
1. Start by creating the `docker-compose.yml` to define the network, MinIO instance, 2x PostgreSQL databases, 2x MongoDB databases, and placeholders for the 4 backend services + frontend + gateway.
2. Implement the `auth-service` and `media-service` (ensure `multer` and `minio` SDK are configured).
3. Implement the `job-service` with the 10-second mock processing logic and the outgoing HTTP webhook call.
4. Implement the `notification-service` to listen for that webhook.
5. Create a clean, functional React UI to tie the user flow together. 
6. Ensure all CORS, environmental variables (DB URIs, MinIO keys), and Docker networking (`http://service-name:port`) are correctly configured so the system boots seamlessly with a single `docker-compose up -d --build`.
