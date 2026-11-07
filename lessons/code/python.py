from workers import Response, WorkerEntrypoint


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        total = sum(range(1, 101))
        return Response.json({"runtime": "python", "total": total})
