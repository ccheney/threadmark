import { type DBSchema, type IDBPDatabase, openDB } from "idb";

export interface Thread {
	threadId: string; // Using URL as the logical ID for now, or a UUID
	url: string;
	title: string;
	createdAt: number;
	updatedAt: number;
}

export interface Bookmark {
	bookmarkId: string;
	threadId: string;
	text: string;
	prefix: string;
	suffix: string;
	createdAt: number;
	tags?: string[]; // Added tags
	occurrence?: number; // Added occurrence index
	// Future: annotations, etc.
}

export interface BookmarkPayload {
	text: string;
	url: string;
	title?: string;
	prefix?: string;
	suffix?: string;
	timestamp?: number;
	tags?: string[];
	occurrence?: number;
}

interface ThreadmarkDB extends DBSchema {
	threads: {
		key: string; // threadId
		value: Thread;
		indexes: { "by-url": string };
	};
	bookmarks: {
		key: string; // bookmarkId
		value: Bookmark;
		indexes: { "by-threadId": string };
	};
}

const DB_NAME = "threadmark-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ThreadmarkDB>>;

export function initDB() {
	if (!dbPromise) {
		dbPromise = openDB<ThreadmarkDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				// Threads Store
				if (!db.objectStoreNames.contains("threads")) {
					const threadStore = db.createObjectStore("threads", {
						keyPath: "threadId",
					});
					threadStore.createIndex("by-url", "url", { unique: false }); // URLs might change for same thread? keeping simple for now.
				}

				// Bookmarks Store
				if (!db.objectStoreNames.contains("bookmarks")) {
					const bookmarkStore = db.createObjectStore("bookmarks", {
						keyPath: "bookmarkId",
					});
					bookmarkStore.createIndex("by-threadId", "threadId", {
						unique: false,
					});
				}
			},
		});
	}
	return dbPromise;
}

export async function saveBookmark(payload: BookmarkPayload) {
	const db = await initDB();

	// 1. Identify Thread
	// Strategy: Use URL as a proxy for thread identity for now.
	// In a real app, we might parse the UUID from the URL (e.g. /c/UUID)
	const url = payload.url;
	const threadId = url; // Simplified thread ID

	// Check if thread exists, if not create it
	let thread = await db.get("threads", threadId);

	if (!thread) {
		thread = {
			threadId,
			url,
			title: payload.title || "Untitled Chat",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		await db.put("threads", thread);
		console.log("Threadmark: Created new thread", threadId);
	} else {
		// Update last active?
		thread.updatedAt = Date.now();
		if (payload.title && payload.title !== thread.title) {
			thread.title = payload.title;
		}
		await db.put("threads", thread);
	}

	// 2. Save Bookmark
	const bookmark: Bookmark = {
		bookmarkId: crypto.randomUUID(),
		threadId: thread.threadId,
		text: payload.text,
		prefix: payload.prefix || "",
		suffix: payload.suffix || "",
		createdAt: payload.timestamp || Date.now(),
		tags: payload.tags || [],
		occurrence: payload.occurrence,
	};

	await db.put("bookmarks", bookmark);
	console.log("Threadmark: Saved bookmark", bookmark.bookmarkId);
	return bookmark;
}
