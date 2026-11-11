const emoji = new RegExp(String.raw`(?:[0-9#*]\uFE0F?\u20E3|\p{Regional_Indicator}{1,2}|(?![©®™])\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?)*)`, 'gu')

export function systemMessageText(text: string) {
  return text.replace(emoji, '').trim()
}
