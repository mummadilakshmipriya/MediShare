# MediShare – Full Stack Demo

This project is a learning/demo scaffold for MediShare using the technologies requested:
- HTML, CSS, JavaScript and React JS (frontend)
- Node.js and Express.js (REST API)
- MongoDB (Node API database option)
- Java Servlets and JSP (separate Java web module)
- JDBC with Oracle Database (Java module database option)

## Important architecture note
Node/Express + MongoDB and Java Servlets/JSP + JDBC/Oracle are two alternative backend approaches. They are included as separate modules so you can study both; they are not one single backend process. The React UI calls the Node/Express API by default. The Java module is provided separately as a learning/reference module.

This is a college project demo, not a production medicine redistribution system. Do not use it to approve or distribute medicines without lawful, qualified review. Login is a demo and is not secure production authentication.

## Requirements
- Node.js and npm
- MongoDB Community Server or MongoDB Atlas connection string (optional; demo API runs in memory if no MongoDB URI is configured)
- Java JDK 17+
- Maven
- Apache Tomcat 10.1+
- Oracle Database and Oracle JDBC driver only if you want to run the Java/JDBC module

## 1. Run React + Node/Express
Open a terminal in `node-api`:
```bash
npm install
npm run dev
```
API starts at `http://localhost:3001`.

In another terminal, open `react-frontend`:
```bash
npm install
npm run dev
```
Open the URL printed by Vite, normally `http://localhost:5173`.

The frontend uses the Node API at `http://localhost:3001/api/medicines`.

### Optional MongoDB connection
Copy `.env.example` to `.env` in `node-api` and set `MONGODB_URI`.
Without a URI, the API uses temporary in-memory demo data; restarting the API resets that data.

## 2. Java Servlet + JSP + JDBC (Oracle) module
The `java-web` folder is a separate Maven WAR project.
1. Set `ORACLE_URL`, `ORACLE_USER`, and `ORACLE_PASSWORD` environment variables.
2. Add an Oracle JDBC driver dependency appropriate for your Oracle setup if your institution provides it. The Maven file contains a commented example because Oracle driver access/version can vary.
3. Create the table shown in `java-web/README.md`.
4. Build with `mvn package`.
5. Deploy `target/medishare-java.war` to Tomcat 10.1+.

This Java module uses Jakarta Servlet APIs. If your lab uses Tomcat 9, it needs `javax.servlet` imports instead of `jakarta.servlet`.

## Project folders
- `react-frontend/` – React UI, CSS, fetches API data
- `node-api/` – Express REST API, optional MongoDB storage
- `java-web/` – JSP + Servlet + JDBC Oracle sample module

## Demo limitations
- Login screen is a demo only; it does not verify real user accounts.
- Do not enter real personal or medical information.
- Add authorization, server-side validation, secure authentication, audit logs, and medicine eligibility checks before any real deployment.
