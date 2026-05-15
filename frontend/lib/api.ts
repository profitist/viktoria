export async function apiRequest(
  endpoint: string,
  token?: string
) {
  const response = await fetch(
    `http://localhost:8000${endpoint}`,
    {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    }
  );

  return response.json();
}
