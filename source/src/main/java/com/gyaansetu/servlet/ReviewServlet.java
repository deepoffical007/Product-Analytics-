package com.gyaansetu.servlet;

import com.gyaansetu.dao.ReviewDao;
import com.gyaansetu.web.ApiException;
import com.gyaansetu.web.ApiServlet;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.sql.Connection;
import java.util.Map;

/** POST /api/reviews/{id}/vote toggles the viewer's "helpful" upvote on a review. */
@WebServlet("/api/reviews/*")
public class ReviewServlet extends ApiServlet {
    @Override
    protected void post(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        if (p.length != 2 || !p[1].equals("vote")) throw ApiException.notFound("Not found.");
        long uid = requireUser(req);
        long reviewId = parseId(p[0]);
        try (Connection c = db()) {
            int[] r = ReviewDao.toggleVote(c, uid, reviewId);
            if (r == null) throw ApiException.notFound("This review does not exist.");
            json(resp, Map.of("voted", r[0] == 1, "upvotes", r[1]));
        }
    }
}
