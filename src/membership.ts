import { Bot } from "grammy";
import { config, resolveChatId } from "./config.js";

const targetChat = resolveChatId(config.TARGET_CHAT_ID);

/**
 * Grant a user access to the private target chat.
 *
 * - "invite_link": create a one-time invite link that expires in 24h and
 *   sends it in a private message to the user.
 * - "approve": the target must be a join-by-request only chat (the bot is an
 *   admin there); we approve the user's pending join request.
 */
export async function grantAccess(bot: Bot, userId: number): Promise<string | null> {
  if (config.GRANT_METHOD === "invite_link") {
    try {
      const link = await bot.api.createChatInviteLink(targetChat, {
        expire_date: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        member_limit: 1,
      });
      await bot.api.sendMessage(
        userId,
        `🎉 You have been granted access!\n\nJoin the group here:\n${link.invite_link}`,
        { link_preview_options: { is_disabled: true } }
      );
      return link.invite_link;
    } catch (err) {
      return null;
    }
  }

  // "approve" method
  try {
    await bot.api.approveChatJoinRequest(targetChat, userId);
    await bot.api.sendMessage(userId, "✅ You have been approved to join the group.");
    return "approved";
  } catch {
    return null;
  }
}

/** Send a friendly "how to join" message to a user who is not a member. */
export function sendNoAccess(bot: Bot, userId: number, username?: string) {
  const mention = username ? `@${username}` : `user id ${userId}`;
  return bot.api.sendMessage(
    userId,
    `Hey ${mention}! It looks like you're not a member yet. Use /subscribe to get access.`
  );
}
