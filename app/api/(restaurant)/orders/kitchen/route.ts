import { auth } from "@/auth";
import { getMongoDb } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

const path = '/api/orders/kitchen';

/**
 * [GET] Fetch all pending and in-progress orders for kitchen display
 * Includes order details, items, table info, and waiter info
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const mongoDb = await getMongoDb();

    // Fetch all pending and in-progress orders with their items and related data
    const orders = await mongoDb
      .collection('orders_table')
      .aggregate([
        {
          $match: {
            status: { $in: ['pending', 'in_progress'] }
          }
        },
        {
          $lookup: {
            from: 'order_items_table',
            localField: '_id',
            foreignField: 'orderId',
            as: 'items'
          }
        },
        {
          $lookup: {
            from: 'restaurant_tables',
            let: { tableId: { $toInt: '$tableId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$id', '$$tableId'] } } }
            ],
            as: 'table'
          }
        },
        {
          $lookup: {
            from: 'users',
            let: { waiterId: { $toInt: '$waiterId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$id', '$$waiterId'] } } }
            ],
            as: 'waiter'
          }
        },
        {
          $sort: { createdAt: 1 }
        },
        {
          $project: {
            _id: 0,
            id: '$_id',
            tableId: 1,
            waiterId: 1,
            orderType: 1,
            status: 1,
            description: 1,
            createdAt: 1,
            items: 1,
            table: { $arrayElemAt: ['$table', 0] },
            waiter: { $arrayElemAt: ['$waiter', 0] }
          }
        }
      ])
      .toArray();

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error(`[GET ${path}] Failed to fetch kitchen orders:`, error);
    return NextResponse.json(
      { error: "Something went wrong while retrieving orders for kitchen." },
      { status: 500 }
    );
  }
}

/**
 * [PATCH] Update order status (used by kitchen staff to mark orders in progress or completed)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "Order ID and status are required." },
        { status: 400 }
      );
    }

    if (!['pending', 'in_progress', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'pending', 'in_progress', or 'completed'." },
        { status: 400 }
      );
    }

    const mongoDb = await getMongoDb();
    const result = await mongoDb
      .collection('orders_table')
      .updateOne(
        { _id: Number(orderId) },
        { $set: { status, updatedAt: new Date() } }
      );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: `Order status updated to ${status}.` },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[PATCH ${path}] Failed to update order status:`, error);
    return NextResponse.json(
      { error: "Something went wrong while updating order status." },
      { status: 500 }
    );
  }
}
