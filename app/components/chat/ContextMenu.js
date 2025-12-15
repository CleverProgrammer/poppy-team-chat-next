'use client';

export default function ContextMenu({
  contextMenu,
  setContextMenu,
  user,
  onReply,
  onEdit,
  onDelete,
  onPromote,
  onDemote,
  onAddToTeamMemory
}) {
  if (!contextMenu) return null;

  const { x, y, message } = contextMenu;
  const isOwnMessage = message.senderId === user?.uid;
  const isPost = message.isPost;

  const handleReply = () => {
    onReply(message.id, message.sender, message.text || message.content);
    setContextMenu(null);
  };

  const handleEdit = () => {
    onEdit(message.id, message.text || message.content);
    setContextMenu(null);
  };

  const handleDelete = () => {
    onDelete(message.id);
    setContextMenu(null);
  };

  const handlePromote = () => {
    onPromote(message.id);
    setContextMenu(null);
  };

  const handleDemote = () => {
    onDemote(message.id);
    setContextMenu(null);
  };

  const handleAddToTeamMemory = () => {
    onAddToTeamMemory(message);
    setContextMenu(null);
  };

  return (
    <div
      className="context-menu"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {!isPost && <button onClick={handleReply}>↩ Reply</button>}
      {isOwnMessage && !isPost && (
        <>
          <button onClick={handleEdit}>Edit</button>
          <button onClick={handleDelete}>💀 Undo Send</button>
        </>
      )}
      {/* Promote/Demote options */}
      {!isPost && <button onClick={handlePromote}>📌 Make it a post</button>}
      {isPost && <button onClick={handleDemote}>💬 Make it a message</button>}
      {/* Team AI Memory - only for own messages */}
      {isOwnMessage && (
        <button onClick={handleAddToTeamMemory}>🧠 Add to Team AI Memory</button>
      )}
    </div>
  );
}
