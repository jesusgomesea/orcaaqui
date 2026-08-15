function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
      <p className="text-[13.5px] text-text-muted">{message}</p>
    </div>
  );
}

export { EmptyState };
