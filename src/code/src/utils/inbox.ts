import type { Message } from "../types";
export function conversationThreads(messages: Message[], userId: string) {
  const threads = new Map<
    string,
    {
      itemId: string;
      participantId: string;
      name: string;
      latest: Message;
      unread: number;
    }
  >();
  for (const message of messages) {
    if (message.senderId !== userId && message.receiverId !== userId) continue;
    const other =
      message.senderId === userId ? message.receiverId : message.senderId;
    const key = JSON.stringify([message.itemId, other]);
    const current = threads.get(key);
    const unread = message.receiverId === userId && !message.isRead ? 1 : 0;
    if (!current)
      threads.set(key, {
        itemId: message.itemId,
        participantId: other,
        name: message.senderId === other ? message.senderName : "",
        latest: message,
        unread,
      });
    else {
      current.unread += unread;
      if (message.senderId === other && message.senderName)
        current.name = message.senderName;
      if (message.timestamp > current.latest.timestamp)
        current.latest = message;
    }
  }
  return [...threads.values()].sort((a, b) =>
    b.latest.timestamp.localeCompare(a.latest.timestamp),
  );
}
