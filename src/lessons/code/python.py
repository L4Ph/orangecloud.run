from workers import Response, WorkerEntrypoint


class Default(WorkerEntrypoint):
    # Python Worker のエントリポイント / Entry point for Python Worker
    async def fetch(self, request):
        total = sum(range(1, 101))
        return Response.json({"runtime": "python", "total": total})
