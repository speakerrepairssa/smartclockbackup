"""
SmartClock HR Avatar Agent
LiveKit + photorealistic avatar (Beyond Presence BEY or Simli)
Reads business HR policies and employee data from room metadata.
"""

import json
import logging
import os

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, JobContext
from livekit.rtc import RpcInvocationData
from livekit.plugins import openai, noise_cancellation

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

    business_id          = metadata.get("businessId", "default")
    employee_name        = metadata.get("employeeName", "Employee")
    hr_config            = metadata.get("hrConfig", {})
    employee_profile     = metadata.get("employeeProfile")     or metadata.get("employeeprofile")
    latest_assessment    = metadata.get("latestAssessment")    or metadata.get("latestassessment")
    pending_applications = metadata.get("pendingApplications") or metadata.get("pendingapplications") or []

    instructions = build_system_prompt(
        business_name        = hr_config.get("businessName", "your company"),
        employee_name        = employee_name,
        leave_policy         = hr_config.get("leavePolicy", ""),
        cash_policy          = hr_config.get("cashPolicy", ""),
        working_hours        = hr_config.get("workingHours", ""),
        extra_notes          = hr_config.get("extraNotes", ""),
        employee_profile     = employee_profile,
        latest_assessment    = latest_assessment,
        pending_applications = pending_applications,
    )

    logger.info(f"Session for employee={employee_name} business={business_id} "
                f"has_profile={employee_profile is not None} "
                f"has_assessment={latest_assessment is not None} "
                f"pending_apps={len(pending_applications)}")

    # ── Build STT → LLM → TTS pipeline ─────────────────────────────────────
    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            voice="coral",        # warm, professional female voice
            model="gpt-4o-realtime-preview",
        )
    )

    # ── Start photorealistic avatar based on voice mode ──────────────────────
    voice_mode = hr_config.get("voiceMode", "livekit-bey")

    avatar = None
    if voice_mode == "livekit-simli":
        try:
            from livekit.plugins import simli
            simli_avatar_id = hr_config.get("simliAvatarId") or os.getenv("SIMLI_AVATAR_ID", "")
            simli_api_key   = hr_config.get("simliApiKey")   or os.getenv("SIMLI_API_KEY", "")
            if simli_avatar_id and simli_api_key:
                avatar = simli.AvatarSession(
                    face_id=simli_avatar_id,
                    api_key=simli_api_key,
                )
                logger.info(f"Using Simli avatar: {simli_avatar_id}")
            else:
                logger.warning("Simli mode selected but SIMLI_AVATAR_ID or SIMLI_API_KEY missing")
        except ImportError:
            logger.warning("livekit.plugins.simli not installed — falling back to no avatar")

    else:  # livekit-bey (default)
        try:
            from livekit.plugins import bey
            bey_avatar_id = hr_config.get("beyAvatarId") or os.getenv("BEY_AVATAR_ID", "")
            if bey_avatar_id:
                avatar = bey.AvatarSession(avatar_id=bey_avatar_id)
                logger.info(f"Using BEY avatar: {bey_avatar_id}")
            else:
                logger.warning("BEY mode selected but BEY_AVATAR_ID missing")
        except ImportError:
            logger.warning("livekit.plugins.bey not installed")

    if avatar:
        await avatar.start(session, room=ctx.room)
    else:
        logger.info("No avatar plugin started — audio-only mode")

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
