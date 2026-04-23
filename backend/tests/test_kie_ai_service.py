import pytest

from app.services.kie_ai import KieAIClient, KieAITaskFailedError


@pytest.mark.asyncio
@pytest.mark.parametrize("terminal_state", ["failed", "error", "timeout"])
async def test_polling_stops_on_terminal_kie_error_states(terminal_state: str):
    client = KieAIClient(api_key="test-key", poll_interval=0, max_polls=3)

    async def fake_check_task_status(task_id: str):
        return {
            "data": {
                "state": terminal_state,
                "failCode": "TIMEOUT",
                "failMsg": "Kie.ai image generation timed out",
            }
        }

    client._check_task_status = fake_check_task_status  # type: ignore[method-assign]

    with pytest.raises(KieAITaskFailedError, match="Kie.ai image generation timed out"):
        await client._poll_task_until_complete("task-123")

    await client.close()
