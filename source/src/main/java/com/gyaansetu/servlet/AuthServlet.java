package com.gyaansetu.servlet;

import com.google.gson.JsonObject;
import com.gyaansetu.dao.UserDao;
import com.gyaansetu.web.ApiException;
import com.gyaansetu.web.ApiServlet;
import com.gyaansetu.web.Passwords;
import com.gyaansetu.web.Views;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.sql.Connection;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * GET  /api/auth/me       current user or null
 * POST /api/auth/signup   {name, email, password}
 * POST /api/auth/login    {email, password}
 * POST /api/auth/guest    creates a guest account for this session
 * POST /api/auth/logout
 */
@WebServlet("/api/auth/*")
public class AuthServlet extends ApiServlet {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    @Override
    protected void get(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        if (p.length != 1 || !p[0].equals("me")) throw ApiException.notFound("Not found.");
        try (Connection c = db()) {
            UserDao.User u = currentUser(c, req);
            if (u == null && userId(req) != null) req.getSession().invalidate();
            json(resp, Map.of("user", u == null ? Map.of() : Views.user(u), "signedIn", u != null));
        }
    }

    @Override
    protected void post(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        String action = p.length == 1 ? p[0] : "";
        switch (action) {
            case "signup" -> signup(req, resp);
            case "login" -> login(req, resp);
            case "guest" -> guest(req, resp);
            case "logout" -> {
                HttpSession s = req.getSession(false);
                if (s != null) s.invalidate();
                json(resp, Map.of("ok", true));
            }
            default -> throw ApiException.notFound("Not found.");
        }
    }

    private void signup(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        JsonObject b = body(req);
        String name = str(b, "name", 80), email = str(b, "email", 190).toLowerCase(), password = str(b, "password", 200);
        if (name.length() < 2) throw ApiException.badRequest("Enter your name.");
        if (!EMAIL.matcher(email).matches()) throw ApiException.badRequest("Enter a valid email address.");
        if (password.length() < 6) throw ApiException.badRequest("Password must be at least 6 characters.");
        try (Connection c = db()) {
            if (UserDao.findByEmail(c, email) != null) throw new ApiException(409, "An account with this email already exists. Log in instead.");
            long id = UserDao.create(c, name, email, Passwords.hash(password), false, 0);
            startSession(req, id);
            json(resp, 201, Map.of("user", Views.user(UserDao.find(c, id))));
        }
    }

    private void login(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        JsonObject b = body(req);
        String email = str(b, "email", 190), password = str(b, "password", 200);
        if (email.isEmpty() || password.isEmpty()) throw ApiException.badRequest("Enter your email and password.");
        try (Connection c = db()) {
            UserDao.Credentials cr = UserDao.findByEmail(c, email);
            if (cr == null || !Passwords.verify(password, cr.passwordHash())) {
                throw new ApiException(401, "Email or password is incorrect.");
            }
            startSession(req, cr.user().id());
            json(resp, Map.of("user", Views.user(cr.user())));
        }
    }

    private void guest(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        try (Connection c = db()) {
            long id = UserDao.create(c, "Guest Learner", null, null, true, 0);
            startSession(req, id);
            json(resp, 201, Map.of("user", Views.user(UserDao.find(c, id))));
        }
    }

    /** Rotates the session id on sign-in to prevent session fixation. */
    private static void startSession(HttpServletRequest req, long userId) {
        HttpSession s = req.getSession(true);
        req.changeSessionId();
        s.setMaxInactiveInterval(60 * 60 * 24 * 7);
        s.setAttribute(SESSION_USER, userId);
    }
}
