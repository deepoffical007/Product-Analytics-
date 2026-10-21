package com.gyaansetu.servlet;

import com.gyaansetu.ai.ClaudeService;
import com.gyaansetu.dao.ResourceDao;
import com.gyaansetu.db.Database;
import com.gyaansetu.web.ApiServlet;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;

/** GET /api/health: confirms the server and database are up. */
@WebServlet("/api/health")
public class HealthServlet extends ApiServlet {
    @Override
    protected void get(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        Map<String, Object> out = new LinkedHashMap<>();
        try (Connection c = db()) {
            out.put("status", "ok");
            out.put("database", c.getMetaData().getDatabaseProductName() + " " + c.getMetaData().getDatabaseProductVersion());
            out.put("resources", ResourceDao.count(c));
        }
        out.put("ai", ClaudeService.enabled() ? "claude" : "offline");
        out.put("dbUrl", Database.url().replaceAll(";.*", ""));
        json(resp, out);
    }
}
