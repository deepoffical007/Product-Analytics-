package com.gyaansetu.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/** JDBC access to user accounts and learning points. */
public final class UserDao {
    private UserDao() {}

    public record User(long id, String name, String email, boolean guest, int points) {}

    public record Credentials(User user, String passwordHash) {}

    public static long create(Connection c, String name, String email, String passwordHash, boolean guest, int points) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO users (name, email, password_hash, is_guest, points) VALUES (?, ?, ?, ?, ?)", Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.setString(2, email);
            ps.setString(3, passwordHash);
            ps.setBoolean(4, guest);
            ps.setInt(5, points);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                keys.next();
                return keys.getLong(1);
            }
        }
    }

    public static User find(Connection c, long id) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT id, name, email, is_guest, points FROM users WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? map(rs) : null; }
        }
    }

    public static Credentials findByEmail(Connection c, String email) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, name, email, is_guest, points, password_hash FROM users WHERE LOWER(email) = LOWER(?)")) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? new Credentials(map(rs), rs.getString("password_hash")) : null; }
        }
    }

    public static void addPoints(Connection c, long id, int points) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("UPDATE users SET points = points + ? WHERE id = ?")) {
            ps.setInt(1, points);
            ps.setLong(2, id);
            ps.executeUpdate();
        }
    }

    public static List<User> leaderboard(Connection c, int limit) throws SQLException {
        List<User> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, name, email, is_guest, points FROM users WHERE is_guest = FALSE ORDER BY points DESC, id ASC LIMIT ?")) {
            ps.setInt(1, limit);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(map(rs)); }
        }
        return out;
    }

    private static User map(ResultSet rs) throws SQLException {
        return new User(rs.getLong("id"), rs.getString("name"), rs.getString("email"), rs.getBoolean("is_guest"), rs.getInt("points"));
    }
}
