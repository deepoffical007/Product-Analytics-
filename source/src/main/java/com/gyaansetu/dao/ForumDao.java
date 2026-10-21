package com.gyaansetu.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/** JDBC access to community threads, answers and thread votes. */
public final class ForumDao {
    private ForumDao() {}

    public record Thread(long id, String author, String title, String body, String subject, int votes,
                         Timestamp createdAt, int answerCount, boolean voted) {}

    public record Answer(long id, String author, String body, boolean ai, Timestamp createdAt) {}

    public static List<Thread> list(Connection c, Long viewerId) throws SQLException {
        List<Thread> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT t.id, t.author, t.title, t.body, t.subject, t.votes, t.created_at, "
                        + "(SELECT COUNT(*) FROM answers a WHERE a.thread_id = t.id) AS answers, "
                        + "CASE WHEN v.user_id IS NULL THEN 0 ELSE 1 END AS voted "
                        + "FROM threads t LEFT JOIN thread_votes v ON v.thread_id = t.id AND v.user_id = ? "
                        + "ORDER BY t.created_at DESC, t.id DESC")) {
            ps.setLong(1, viewerId == null ? -1 : viewerId);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(map(rs)); }
        }
        return out;
    }

    public static Thread find(Connection c, long id, Long viewerId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT t.id, t.author, t.title, t.body, t.subject, t.votes, t.created_at, "
                        + "(SELECT COUNT(*) FROM answers a WHERE a.thread_id = t.id) AS answers, "
                        + "CASE WHEN v.user_id IS NULL THEN 0 ELSE 1 END AS voted "
                        + "FROM threads t LEFT JOIN thread_votes v ON v.thread_id = t.id AND v.user_id = ? WHERE t.id = ?")) {
            ps.setLong(1, viewerId == null ? -1 : viewerId);
            ps.setLong(2, id);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? map(rs) : null; }
        }
    }

    public static List<Answer> answers(Connection c, long threadId) throws SQLException {
        List<Answer> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, author, body, is_ai, created_at FROM answers WHERE thread_id = ? ORDER BY created_at, id")) {
            ps.setLong(1, threadId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(new Answer(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getBoolean(4), rs.getTimestamp(5)));
            }
        }
        return out;
    }

    public static long create(Connection c, Long userId, String author, String title, String body, String subject,
                              int votes, Timestamp at) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO threads (user_id, author, title, body, subject, votes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            if (userId == null) ps.setNull(1, java.sql.Types.BIGINT); else ps.setLong(1, userId);
            ps.setString(2, author);
            ps.setString(3, title);
            ps.setString(4, body);
            ps.setString(5, subject);
            ps.setInt(6, votes);
            ps.setTimestamp(7, at == null ? new Timestamp(System.currentTimeMillis()) : at);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) { keys.next(); return keys.getLong(1); }
        }
    }

    public static long addAnswer(Connection c, long threadId, Long userId, String author, String body, boolean ai, Timestamp at) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO answers (thread_id, user_id, author, body, is_ai, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, threadId);
            if (userId == null) ps.setNull(2, java.sql.Types.BIGINT); else ps.setLong(2, userId);
            ps.setString(3, author);
            ps.setString(4, body);
            ps.setBoolean(5, ai);
            ps.setTimestamp(6, at == null ? new Timestamp(System.currentTimeMillis()) : at);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) { keys.next(); return keys.getLong(1); }
        }
    }

    /** Toggles the user's upvote and returns the thread's new vote count. */
    public static int toggleVote(Connection c, long userId, long threadId) throws SQLException {
        boolean nowVoted;
        try (PreparedStatement del = c.prepareStatement("DELETE FROM thread_votes WHERE user_id = ? AND thread_id = ?")) {
            del.setLong(1, userId);
            del.setLong(2, threadId);
            nowVoted = del.executeUpdate() == 0;
        }
        if (nowVoted) {
            try (PreparedStatement ins = c.prepareStatement("INSERT INTO thread_votes (user_id, thread_id) VALUES (?, ?)")) {
                ins.setLong(1, userId);
                ins.setLong(2, threadId);
                ins.executeUpdate();
            }
        }
        try (PreparedStatement up = c.prepareStatement("UPDATE threads SET votes = GREATEST(votes + ?, 0) WHERE id = ?")) {
            up.setInt(1, nowVoted ? 1 : -1);
            up.setLong(2, threadId);
            up.executeUpdate();
        }
        try (PreparedStatement ps = c.prepareStatement("SELECT votes FROM threads WHERE id = ?")) {
            ps.setLong(1, threadId);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return rs.getInt(1); }
        }
    }

    private static Thread map(ResultSet rs) throws SQLException {
        return new Thread(rs.getLong("id"), rs.getString("author"), rs.getString("title"), rs.getString("body"), rs.getString("subject"),
                rs.getInt("votes"), rs.getTimestamp("created_at"), rs.getInt("answers"), rs.getInt("voted") == 1);
    }
}
