"""
SmartClock HR Avatar Agent
LiveKit + Beyond Presence (BEY) photorealistic video avatar
Reads business HR policies from room metadata (set by token-server.js)
"""

import json
import logging
import os

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, JobContext
from livekit.rtc import RpcInvocationData
from livekit.plugins import openai, noise_cancellation, bey

from prompts import DEFAULT_HR_PROMPT, build_system_prompt

load_dotenv(".env")

logger = logging.getLogger("hr-avatar-agent")
logging.basicConfig(level=logging.INFO)


class HRAssistant(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(instructions=instructions)


server = AgentServer()


@server.rtc_session(agent_name="smartclock-hr-agent")
async def entrypoint(ctx: JobContext):
    # ── Read business config from room metadata ─────────────────────────────
    try:
        metadata = json.loads(ctx.room.metadata or "{}")
    except Exception:
        metadata = {}

    business_id   = metadata.get("businessId", "default")
    employee_name = metadata.get("employeeName", "Employee")
    hr_config     = metadata.get("hrConfig", {})

    instructions = build_system_prompt(
        business_name = hr_config.get("businessName", "your company"),
        employee_name = employee_name,
        leave_policy  = hr_config.get("leavePolicy", ""),
        working_hours = hr_config.get("workingHours", ""),
        extra_notes   = hr_config.get("extraNotes", ""),
    )

    logger.info(f"Session for employee={employee_name} business={business_id}")

    # ── Build STT → LLM → TTS pipeline ─────────────────────────────────────
    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            voice="coral",        # warm, professional female voice
            model="gpt-4o-realtime-preview",
        )
    )

    # ── Start BEY photorealistic avatar ─────────────────────────────────────
    avatar_id = os.getenv("BEY_AVATAR_ID")
    if not avatar_id:
        logger.warning("BEY_AVATAR_ID not set — avatar will not render video")

    avatar = bey.AvatarSession(avatar_id=avatar_id)
    await avatar.start(session, room=ctx.room)

    # ── Connect to room ──────────────────────────────────────────────────────
    await ctx.connect()

    # ── Register RPC: receive typed text from employee ───────────────────────
    async def handle_text_message(data: RpcInvocationData) -> str:
        try:
            payload = json.loads(data.payload)
            text = payload.get("text", "").strip()
            if text:
                logger.info(f"Received text from frontend: {text}")
                # Inject as user chat message into the realtime session
                await session.generate_reply(
                    instructions=f"The employee just typed the following message (treat as if they said it): {text}"
                )
        except Exception as e:
            logger.error(f"handle_text_message error: {e}")
        return "ok"

    ctx.room.local_participant.register_rpc_method("agent.chat", handle_text_message)

    # ── Start agent session ──────────────────────────────────────────────────
    await session.start(
        room=ctx.room,
        agent=HRAssistant(instructions=instructions),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    # ── Greet the employee ───────────────────────────────────────────────────
    await session.generate_reply(
        instructions=(
            f"Greet {employee_name} warmly by name. "
            "Introduce yourself as Lerato, the SmartClock HR assistant. "
            "Ask how you can help them today. Keep it short and friendly."
        )
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
