'use client';

export default function ContextMenu({
  contextMenu,
  setContextMenu,
  user,
  onReply,
  onEdit,
  onDelete
}) {
  if (!contextMenu) return null;

  const { x, y, message } = contextMenu;
  const isOwnMessage = message.senderId === user?.uid;

  const handleReply = () => {
    onReply(message.id, message.sender, message.text);
    setContextMenu(null);
  };

  const handleEdit = () => {
    onEdit(message.id, message.text);
    setContextMenu(null);
  };

  const handleDelete = () => {
    onDelete(message.id);
    setContextMenu(null);
  };

  return (
    <div
      className="context-menu"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={handleReply}>↩ Reply</button>
      {isOwnMessage && (
        <>
          <button onClick={handleEdit}>Edit</button>
          <button onClick={handleDelete}>💀 Undo Send</button>
        </>
      )}
    </div>
  );
}
