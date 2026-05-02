"use server";

import { User } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";

type MongoUser = {
  id: number;
  image?: string | null;
  name?: string | null;
  email: string;
  password: string;
  is_active?: boolean;
  role_id?: number | string;
  created_at?: Date;
};

type MongoRole = {
  id: number;
  role: string;
};

async function getRolesById() {
  const mongoDb = await getMongoDb();
  const roles = await mongoDb.collection<MongoRole>(mongoCollections.roles).find().toArray();
  return new Map(roles.map((role) => [Number(role.id), role]));
}

function formatUser(user: MongoUser, roleName = ""): User {
  return {
    id: user.id,
    image: user.image ?? null,
    name: user.name ?? "",
    password: user.password,
    email: user.email,
    is_active: user.is_active ?? false,
    role_id: String(user.role_id ?? ""),
    role_name: roleName,
    created_at: user.created_at ? new Date(user.created_at) : new Date(),
  };
}

export const getAllUserWithRole = async (): Promise<User[]> => {
  const mongoDb = await getMongoDb();
  const [users, rolesById] = await Promise.all([
    mongoDb.collection<MongoUser>(mongoCollections.users).find().sort({ id: 1 }).toArray(),
    getRolesById(),
  ]);

  return users.map((user) => formatUser(user, rolesById.get(Number(user.role_id))?.role ?? ""));
};

export const getUserWithRole = async (id: number): Promise<User> => {
  const mongoDb = await getMongoDb();
  const user = await mongoDb.collection<MongoUser>(mongoCollections.users).findOne({ id });

  if (!user) {
    throw new Error("User not found");
  }

  const rolesById = await getRolesById();
  return formatUser(user, rolesById.get(Number(user.role_id))?.role ?? "");
};

export const getUserForSignin = async (email: string, password: string) => {
  const mongoDb = await getMongoDb();
  const user = await mongoDb.collection<MongoUser>(mongoCollections.users).findOne({ email, password });

  if (!user) return null;

  const rolesById = await getRolesById();
  return {
    id: String(user.id),
    name: user.name ?? "",
    email: user.email,
    is_active: user.is_active ?? false,
    role_id: String(user.role_id ?? ""),
    role_name: rolesById.get(Number(user.role_id))?.role ?? "",
    created_at: user.created_at ?? new Date(),
  };
};
