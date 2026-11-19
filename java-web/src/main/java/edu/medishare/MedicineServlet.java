package edu.medishare;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

@WebServlet("/medicines")
public class MedicineServlet extends HttpServlet {
    private Connection getConnection() throws Exception {
        String url = System.getenv("ORACLE_URL");
        String user = System.getenv("ORACLE_USER");
        String password = System.getenv("ORACLE_PASSWORD");
        if (url == null || user == null || password == null) {
            throw new IllegalStateException("Set ORACLE_URL, ORACLE_USER, and ORACLE_PASSWORD first.");
        }
        return DriverManager.getConnection(url, user, password);
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        List<String[]> rows = new ArrayList<>();
        String error = null;
        String sql = "SELECT MEDICINE_NAME, QUANTITY, EXPIRY_DATE, DONOR_NAME FROM MEDICINE_LISTING ORDER BY ID DESC";
        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                rows.add(new String[] {
                    result.getString("MEDICINE_NAME"),
                    result.getString("QUANTITY"),
                    result.getString("EXPIRY_DATE"),
                    result.getString("DONOR_NAME")
                });
            }
        } catch (Exception ex) {
            error = "Database is not configured or the query failed. Check java-web/README.md and Tomcat logs.";
        }
        request.setAttribute("medicines", rows);
        request.setAttribute("databaseError", error);
        request.getRequestDispatcher("/WEB-INF/medicines.jsp").forward(request, response);
    }
}
