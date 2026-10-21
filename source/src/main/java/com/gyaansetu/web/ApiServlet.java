package com.gyaansetu.web;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.gyaansetu.dao.UserDao;
import com.gyaansetu.db.Database;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.io.Reader;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/** Base class for all JSON endpoints: error handling, body parsing, path segments and session auth. */
public abstract class ApiServlet extends HttpServlet {
    protected static final Gson GSON = new GsonBuilder().disableHtmlEscaping().serializeNulls().create();
    private static final Logger LOG = Logger.getLogger(ApiServlet.class.getName());
    private static final int MAX_BODY = 1_000_000;
    public static final String SESSION_USER = "userId";

    /** Subclasses override the verbs they support; anything else answers 405. */
    protected void get(HttpServletRequest req, HttpServletResponse resp) throws Exception { notAllowed(); }
    protected void post(HttpServletRequest req, HttpServletResponse resp) throws Exception { notAllowed(); }
    protected void put(HttpServletRequest req, HttpServletResponse resp) throws Exception { notAllowed(); }
    protected void delete(HttpServletRequest req, HttpServletResponse resp) throws Exception { notAllowed(); }

    @Override protected final void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException { dispatch(req, resp, "GET"); }
    @Override protected final void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException { dispatch(req, resp, "POST"); }
    @Override protected final void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException { dispatch(req, resp, "PUT"); }
    @Override protected final void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException { dispatch(req, resp, "DELETE"); }

    private void dispatch(HttpServletRequest req, HttpServletResponse resp, String verb) throws IOException {
        req.setCharacterEncoding("UTF-8");
        resp.setCharacterEncoding("UTF-8");
        resp.setContentType("application/json");
        try {
            switch (verb) {
                case "GET" -> get(req, resp);
                case "POST" -> post(req, resp);
                case "PUT" -> put(req, resp);
                default -> delete(req, resp);
            }
        } catch (ApiException e) {
            error(resp, e.status, e.getMessage());
        } catch (SQLException e) {
            LOG.log(Level.SEVERE, "Database error on " + verb + " " + req.getRequestURI(), e);
            error(resp, 500, "A database error occurred. Please try again.");
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Unexpected error on " + verb + " " + req.getRequestURI(), e);
            error(resp, 500, "Something went wrong on the server. Please try again.");
        }
    }

    private static void error(HttpServletResponse resp, int status, String message) throws IOException {
        if (resp.isCommitted()) return;
        resp.resetBuffer();
        resp.setStatus(status);
        resp.setContentType("application/json");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        body.put("status", status);
        resp.getWriter().write(GSON.toJson(body));
    }

    protected static void json(HttpServletResponse resp, Object body) throws IOException {
        resp.getWriter().write(GSON.toJson(body));
    }

    protected static void json(HttpServletResponse resp, int status, Object body) throws IOException {
        resp.setStatus(status);
        json(resp, body);
    }

    protected static JsonObject body(HttpServletRequest req) throws IOException {
        if (req.getContentLengthLong() > MAX_BODY) throw ApiException.badRequest("Request body is too large.");
        try (Reader r = req.getReader()) {
            char[] buf = new char[8192];
            StringBuilder sb = new StringBuilder();
            int n;
            while ((n = r.read(buf)) > 0) {
                sb.append(buf, 0, n);
                if (sb.length() > MAX_BODY) throw ApiException.badRequest("Request body is too large.");
            }
            if (sb.toString().isBlank()) return new JsonObject();
            JsonElement el = JsonParser.parseString(sb.toString());
            if (!el.isJsonObject()) throw ApiException.badRequest("Expected a JSON object.");
            return el.getAsJsonObject();
        } catch (com.google.gson.JsonParseException e) {
            throw ApiException.badRequest("Malformed JSON.");
        }
    }

    protected static String str(JsonObject o, String key, int maxLen) {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) return "";
        String s = e.isJsonPrimitive() ? e.getAsString().trim() : "";
        if (s.length() > maxLen) throw ApiException.badRequest("'" + key + "' must be at most " + maxLen + " characters.");
        return s;
    }

    /** Path segments after the servlet mapping, e.g. "/py/like" becomes ["py", "like"]. */
    protected static String[] path(HttpServletRequest req) {
        String p = req.getPathInfo();
        if (p == null || p.equals("/")) return new String[0];
        return Arrays.stream(p.substring(1).split("/")).filter(s -> !s.isEmpty()).toArray(String[]::new);
    }

    protected static long parseId(String s) {
        try { return Long.parseLong(s); } catch (NumberFormatException e) { throw ApiException.notFound("Not found."); }
    }

    protected static Long userId(HttpServletRequest req) {
        HttpSession s = req.getSession(false);
        return s == null ? null : (Long) s.getAttribute(SESSION_USER);
    }

    protected static long requireUser(HttpServletRequest req) {
        Long id = userId(req);
        if (id == null) throw ApiException.unauthorized();
        return id;
    }

    protected static UserDao.User currentUser(Connection c, HttpServletRequest req) throws SQLException {
        Long id = userId(req);
        return id == null ? null : UserDao.find(c, id);
    }

    protected static Connection db() throws SQLException { return Database.get(); }

    protected static void notAllowed() { throw new ApiException(405, "Method not allowed."); }
}
