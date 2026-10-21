package com.gyaansetu.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/** JDBC access to reviews and review upvotes. */
public final class ReviewDao {
    private ReviewDao() {}

    public record Review(long id, String resourceId, Long userId, String author, String body, Integer stars,
                         double sentiment, int upvotes, Timestamp createdAt, boolean voted, boolean mine) {}

    public static long add(Connection c, String resourceId, Long userId, String author, String body, Integer stars,
                           double sentiment, int upvotes, Timestamp createdAt) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO reviews (resource_id, user_id, author, body, stars, sentiment, upvotes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, resourceId);
            if (userId == null) ps.setNull(2, java.sql.Types.BIGINT); else ps.setLong(2, userId);
            ps.setString(3, author);
            ps.setString(4, body);
            if (stars == null) ps.setNull(5, java.sql.Types.INTEGER); else ps.setInt(5, stars);
            ps.setDouble(6, sentiment);
            ps.setInt(7, upvotes);
            ps.setTimestamp(8, createdAt == null ? new Timestamp(System.currentTimeMillis()) : createdAt);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) { keys.next(); return keys.getLong(1); }
        }
    }

    /** Removes the user's existing review of a resource. Returns true when one existed. */
    public static boolean deleteByUser(Connection c, String resourceId, long userId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("DELETE FROM reviews WHERE resource_id = ? AND user_id = ?")) {
            ps.setString(1, resourceId);
            ps.setLong(2, userId);
            return ps.executeUpdate() > 0;
        }
    }

    /** Reviews for a resource: the viewer's own first, then by upvotes and recency. */
    public static List<Review> list(Connection c, String resourceId, Long viewerId) throws SQLException {
        List<Review> out = new ArrayList<>();
        long viewer = viewerId == null ? -1 : viewerId;
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT r.id, r.resource_id, r.user_id, r.author, r.body, r.stars, r.sentiment, r.upvotes, r.created_at, "
                        + "CASE WHEN v.user_id IS NULL THEN 0 ELSE 1 END AS voted "
                        + "FROM reviews r LEFT JOIN review_votes v ON v.review_id = r.id AND v.user_id = ? "
                        + "WHERE r.resource_id = ? "
                        + "ORDER BY CASE WHEN r.user_id = ? THEN 0 ELSE 1 END, r.upvotes DESC, r.created_at DESC")) {
            ps.setLong(1, viewer);
            ps.setString(2, resourceId);
            ps.setLong(3, viewer);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long uid = rs.getLong("user_id");
                    Long userId = rs.wasNull() ? null : uid;
                    int stars = rs.getInt("stars");
                    Integer s = rs.wasNull() ? null : stars;
                    out.add(new Review(rs.getLong("id"), rs.getString("resource_id"), userId, rs.getString("author"), rs.getString("body"),
                            s, rs.getDouble("sentiment"), rs.getInt("upvotes"), rs.getTimestamp("created_at"),
                            rs.getInt("voted") == 1, userId != null && userId == viewer));
                }
            }
        }
        return out;
    }

    /** Toggles the viewer's upvote. Returns {nowVoted ? 1 : 0, newCount}, or null when the review does not exist. */
    public static int[] toggleVote(Connection c, long userId, long reviewId) throws SQLException {
        try (PreparedStatement chk = c.prepareStatement("SELECT 1 FROM reviews WHERE id = ?")) {
            chk.setLong(1, reviewId);
            try (ResultSet rs = chk.executeQuery()) { if (!rs.next()) return null; }
        }
        boolean nowVoted;
        try (PreparedStatement del = c.prepareStatement("DELETE FROM review_votes WHERE user_id = ? AND review_id = ?")) {
            del.setLong(1, userId);
            del.setLong(2, reviewId);
            nowVoted = del.executeUpdate() == 0;
        }
        if (nowVoted) {
            try (PreparedStatement ins = c.prepareStatement("INSERT INTO review_votes (user_id, review_id) VALUES (?, ?)")) {
                ins.setLong(1, userId);
                ins.setLong(2, reviewId);
                ins.executeUpdate();
            }
        }
        try (PreparedStatement up = c.prepareStatement("UPDATE reviews SET upvotes = GREATEST(upvotes + ?, 0) WHERE id = ?")) {
            up.setInt(1, nowVoted ? 1 : -1);
            up.setLong(2, reviewId);
            up.executeUpdate();
        }
        try (PreparedStatement ps = c.prepareStatement("SELECT upvotes FROM reviews WHERE id = ?")) {
            ps.setLong(1, reviewId);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return new int[]{nowVoted ? 1 : 0, rs.getInt(1)}; }
        }
    }
}
