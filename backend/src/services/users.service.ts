import { all, get, run } from "../db/index.js";

interface UserRow {
  id: number;
  name: string;
  username: string;
  pin?: string;
  is_admin: number;
  can_scan: number;
  can_report: number;
  created_at: string;
}

interface UserRolesPayload {
  isAdmin?: boolean;
  canScan?: boolean;
  canReport?: boolean;
}

interface UserMutationPayload {
  name?: unknown;
  username?: unknown;
  pin?: unknown;
  roles?: UserRolesPayload;
}

const PIN_PATTERN = /^\d{4}$/;

const mapUserRoles = (user: Pick<UserRow, "is_admin" | "can_scan" | "can_report">) => ({
  isAdmin: user.is_admin === 1,
  canScan: user.can_scan === 1,
  canReport: user.can_report === 1,
});

export const mapUserForResponse = (user: UserRow) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  roles: mapUserRoles(user),
  createdAt: user.created_at,
});

export const authenticateUser = (username: unknown, pin: unknown) => {
  if (!username || !pin) {
    return { error: "Username and PIN are required", user: null };
  }

  const user = get<UserRow>(
    "SELECT id, name, username, is_admin, can_scan, can_report, created_at FROM users WHERE username = :username AND pin = :pin",
    { ":username": username, ":pin": pin }
  );

  if (!user) {
    return { error: "Invalid credentials", user: null };
  }

  return {
    error: null,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      roles: mapUserRoles(user),
    },
  };
};

export const listUsers = () => {
  const users = all<UserRow>(
    "SELECT id, name, username, is_admin, can_scan, can_report, created_at FROM users ORDER BY name ASC"
  );

  const mappedUsers = users.map(mapUserForResponse);
  return { count: mappedUsers.length, users: mappedUsers };
};

export const createUser = (payload: UserMutationPayload) => {
  const { name, username, pin, roles } = payload;

  if (!name || !username || !pin) {
    return { error: "name, username and pin are required" };
  }

  if (typeof name !== "string" || typeof username !== "string" || typeof pin !== "string") {
    return { error: "name, username and pin are required" };
  }

  if (!PIN_PATTERN.test(pin)) {
    return { error: "PIN must be exactly 4 digits" };
  }

  const trimmedUsername = username.trim();
  const existing = get("SELECT id FROM users WHERE username = :username", {
    ":username": trimmedUsername,
  });
  if (existing) {
    return { error: "Username already exists" };
  }

  const now = new Date().toISOString();
  run(
    `INSERT INTO users (name, username, pin, is_admin, can_scan, can_report, created_at)
     VALUES (:name, :username, :pin, :isAdmin, :canScan, :canReport, :now)`,
    {
      ":name": name.trim(),
      ":username": trimmedUsername,
      ":pin": pin,
      ":isAdmin": roles?.isAdmin ? 1 : 0,
      ":canScan": roles?.canScan ? 1 : 0,
      ":canReport": roles?.canReport ? 1 : 0,
      ":now": now,
    }
  );

  return { error: null };
};

export const updateUser = (rawId: string, payload: UserMutationPayload) => {
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) {
    return { error: "Invalid ID format", notFound: false };
  }

  const existing = get<Pick<UserRow, "id" | "username">>("SELECT id, username FROM users WHERE id = :id", {
    ":id": id,
  });
  if (!existing) {
    return { error: "User not found", notFound: true };
  }

  const updates: string[] = [];
  const params: Record<string, string | number> = { ":id": id };

  if (payload.name) {
    if (typeof payload.name !== "string") {
      return { error: "name must be a string", notFound: false };
    }

    updates.push("name = :name");
    params[":name"] = payload.name.trim();
  }

  if (payload.username && payload.username !== existing.username) {
    if (typeof payload.username !== "string") {
      return { error: "username must be a string", notFound: false };
    }

    const trimmedUsername = payload.username.trim();
    const duplicate = get("SELECT id FROM users WHERE username = :username", {
      ":username": trimmedUsername,
    });
    if (duplicate) {
      return { error: "Username already assigned to another user", notFound: false };
    }

    updates.push("username = :username");
    params[":username"] = trimmedUsername;
  }

  if (payload.pin) {
    if (typeof payload.pin !== "string" || !PIN_PATTERN.test(payload.pin)) {
      return { error: "PIN must be exactly 4 digits", notFound: false };
    }

    updates.push("pin = :pin");
    params[":pin"] = payload.pin;
  }

  if (payload.roles) {
    if (payload.roles.isAdmin !== undefined) {
      updates.push("is_admin = :isAdmin");
      params[":isAdmin"] = payload.roles.isAdmin ? 1 : 0;
    }
    if (payload.roles.canScan !== undefined) {
      updates.push("can_scan = :canScan");
      params[":canScan"] = payload.roles.canScan ? 1 : 0;
    }
    if (payload.roles.canReport !== undefined) {
      updates.push("can_report = :canReport");
      params[":canReport"] = payload.roles.canReport ? 1 : 0;
    }
  }

  if (updates.length > 0) {
    run(`UPDATE users SET ${updates.join(", ")} WHERE id = :id`, params);
  }

  return { error: null, notFound: false };
};

export const deleteUser = (rawId: string) => {
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) {
    return { error: "Invalid ID format", forbidden: false, notFound: false };
  }

  if (id === 1) {
    return {
      error: "Cannot delete the primary administrator account",
      forbidden: true,
      notFound: false,
    };
  }

  const existing = get("SELECT id FROM users WHERE id = :id", { ":id": id });
  if (!existing) {
    return { error: "User not found", forbidden: false, notFound: true };
  }

  run("DELETE FROM users WHERE id = :id", { ":id": id });
  return { error: null, forbidden: false, notFound: false };
};
