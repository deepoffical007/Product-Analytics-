package com.gyaansetu.servlet;

import com.gyaansetu.web.ApiException;
import com.gyaansetu.web.ApiServlet;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Catch-all for unknown /api paths so clients always get JSON, never an HTML error page. */
@WebServlet("/api/*")
public class NotFoundServlet extends ApiServlet {
    private static ApiException missing(HttpServletRequest req) {
        return ApiException.notFound("No API endpoint at " + req.getRequestURI() + ".");
    }

    @Override protected void get(HttpServletRequest req, HttpServletResponse resp) { throw missing(req); }
    @Override protected void post(HttpServletRequest req, HttpServletResponse resp) { throw missing(req); }
    @Override protected void put(HttpServletRequest req, HttpServletResponse resp) { throw missing(req); }
    @Override protected void delete(HttpServletRequest req, HttpServletResponse resp) { throw missing(req); }
}
