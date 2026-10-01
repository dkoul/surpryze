export function ResetForm() {
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/password-reset', { method: 'POST' });
  }

  return (
    <form onSubmit={submit}>
      <input name="email" type="email" />
      <button type="submit">Send reset</button>
    </form>
  );
}
