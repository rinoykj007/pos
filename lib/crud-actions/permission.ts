"use server";

import { Permissions as PermissionType } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";

type MongoPermission = PermissionType & {
  label?: string;
};

type MongoRole = {
  id: number;
  role: string;
};

type MongoModule = {
  id: number;
  name: string;
  label?: string;
};

export const getPermissionsViaRoleId = async (id: number): Promise<PermissionType[]> => {
  const mongoDb = await getMongoDb();
  const [permissions, roles, modules] = await Promise.all([
    mongoDb.collection<MongoPermission>(mongoCollections.permissions).find({ role_id: id }).toArray(),
    mongoDb.collection<MongoRole>(mongoCollections.roles).find().toArray(),
    mongoDb.collection<MongoModule>(mongoCollections.modules).find().toArray(),
  ]);

  const rolesById = new Map(roles.map((role) => [Number(role.id), role]));
  const modulesById = new Map(modules.map((mod) => [Number(mod.id), mod]));

  return permissions.map((permission) => ({
    id: permission.id,
    role_id: Number(permission.role_id ?? 0),
    role_name: rolesById.get(Number(permission.role_id))?.role ?? "",
    module_id: Number(permission.module_id ?? 0),
    module_name: modulesById.get(Number(permission.module_id))?.name ?? "",
    can_view: permission.can_view ?? false,
    can_create: permission.can_create ?? false,
    can_edit: permission.can_edit ?? false,
    can_delete: permission.can_delete ?? false,
  }));
};
