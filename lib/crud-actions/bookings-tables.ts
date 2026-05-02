"use server";

import { BookingsTablesInterface } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";
import { updateData } from "./general-actions";

type BookingStatus = "scheduled" | "booked" | "completed" | "expired" | "processing" | "cancelled";

export const getAllBookingsTables = async (): Promise<BookingsTablesInterface[]> => {
  const mongoDb = await getMongoDb();
  const [bookings, users, tables] = await Promise.all([
    mongoDb.collection(mongoCollections.bookingsTables).find().sort({ id: -1 }).toArray(),
    mongoDb.collection(mongoCollections.users).find().toArray(),
    mongoDb.collection(mongoCollections.restaurantTables).find().toArray(),
  ]);

  const usersById = new Map(users.map((user) => [Number(user.id), user]));
  const tablesById = new Map(tables.map((table) => [Number(table.id), table]));

  return bookings.map((booking) => {
    const user = usersById.get(Number(booking.bookedByUserId));
    const table = tablesById.get(Number(booking.tableId));

    return {
      id: booking.id,
      tableId: String(booking.tableId),
      tableName: table?.table_number ?? null,
      customerName: booking.customerName,
      advancePaid: booking.advancePaid ?? "0.00",
      status: booking.status,
      bookedByUserId: booking.bookedByUserId,
      bookedByUserName: user?.name ?? null,
      bookedByUserEmail: user?.email ?? null,
      reservationStart: new Date(booking.reservationStart),
      reservationEnd: new Date(booking.reservationEnd),
      bookingDate: new Date(booking.bookingDate ?? new Date()),
    };
  });
};

export async function syncBookingAndTableStatuses(): Promise<void> {
  const mongoDb = await getMongoDb();
  const now = new Date();
  const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
  const bookings = await mongoDb.collection(mongoCollections.bookingsTables).find().toArray();

  for (const booking of bookings) {
    const table = await mongoDb.collection(mongoCollections.restaurantTables).findOne({ id: booking.tableId });
    if (!table) continue;

    const reservationStart = new Date(booking.reservationStart);
    const reservationEnd = new Date(booking.reservationEnd);
    const gracePeriodEnd = new Date(reservationEnd.getTime() + 2 * 60 * 60 * 1000);
    const status = booking.status as BookingStatus;

    if (status === "cancelled" || status === "completed") {
      if (status === "cancelled" && table.status !== "available") {
        await updateData("restaurantTables", "id", table.id, { status: "available" });
      }
      continue;
    }

    if (table.status === "occupied" && status === "processing") continue;

    if (table.status === "occupied" && ["booked", "scheduled"].includes(status) && reservationStart <= now && reservationEnd >= now) {
      await updateData("bookingsTables", "id", booking.id, { status: "processing" });
      continue;
    }

    if (status === "booked" && table.status === "booked" && now > reservationEnd) {
      if (now <= gracePeriodEnd) continue;
      await updateData("bookingsTables", "id", booking.id, { status: "expired" });
      await updateData("restaurantTables", "id", table.id, { status: "available" });
      continue;
    }

    if (reservationStart > thirtyMinutesFromNow && status !== "scheduled") {
      await updateData("bookingsTables", "id", booking.id, { status: "scheduled" });
      continue;
    }

    if (reservationStart <= thirtyMinutesFromNow && reservationEnd >= now && table.status === "available") {
      await updateData("bookingsTables", "id", booking.id, { status: "booked" });
      await updateData("restaurantTables", "id", table.id, { status: "booked" });
      continue;
    }

    if (now > reservationEnd && status !== "expired") {
      await updateData("bookingsTables", "id", booking.id, { status: "expired" });
      await updateData("restaurantTables", "id", table.id, { status: "available" });
    }
  }
}

export async function updateTableAndBookingStatus(tableId: number, mode: "check-in" | "check-out") {
  if (!tableId) return;

  const mongoDb = await getMongoDb();
  const now = new Date();

  if (mode === "check-in") {
    const booking = await mongoDb
      .collection(mongoCollections.bookingsTables)
      .find({
        tableId,
        status: { $in: ["booked", "scheduled"] },
        reservationStart: { $lte: new Date(now.getTime() + 30 * 60 * 1000) },
        reservationEnd: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
      })
      .sort({ reservationStart: -1 })
      .limit(1)
      .next();

    if (booking) await updateData("bookingsTables", "id", booking.id, { status: "processing" });
    await updateData("restaurantTables", "id", tableId, { status: "occupied" });
    return;
  }

  const booking = await mongoDb
    .collection(mongoCollections.bookingsTables)
    .find({ tableId, status: "processing" })
    .sort({ reservationStart: -1 })
    .limit(1)
    .next();

  if (booking) await updateData("bookingsTables", "id", booking.id, { status: "completed" });
  await updateData("restaurantTables", "id", tableId, { status: "available" });
}
