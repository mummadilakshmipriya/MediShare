<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ page import="java.util.List" %>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MediShare Java Listings</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f3f7fc;color:#17243a;margin:0;padding:30px}
    main{max-width:900px;margin:auto;background:white;padding:24px;border-radius:16px}
    h1{color:#1559b7}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:12px;border-bottom:1px solid #e4ebf4}
    th{background:#eaf3ff}.notice{padding:12px;background:#fff4df;border-radius:8px}
  </style>
</head>
<body><main>
  <h1>MediShare – Java/JSP Demo</h1>
  <p>Listings read using a Java Servlet and JDBC.</p>
  <% String error = (String) request.getAttribute("databaseError"); %>
  <% if (error != null) { %><p class="notice"><%= error %></p><% } else { %>
  <table><thead><tr><th>Medicine</th><th>Quantity</th><th>Expiry date</th><th>Donor</th></tr></thead><tbody>
  <% List<String[]> medicines = (List<String[]>) request.getAttribute("medicines"); %>
  <% if (medicines == null || medicines.isEmpty()) { %><tr><td colspan="4">No records found.</td></tr><% } else { for (String[] row : medicines) { %>
    <tr><td><%= row[0] %></td><td><%= row[1] %></td><td><%= row[2] %></td><td><%= row[3] %></td></tr>
  <% } } %>
  </tbody></table>
  <% } %>
  <p class="notice">Educational prototype only. Do not use for actual medicine approval or redistribution.</p>
</main></body></html>
