export type Intent =
  | "vague"
  | "recommend"
  | "refine"
  | "compare"
  | "off_topic"
  | "injection";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const OFF_TOPIC_PATTERNS = [
  /general hiring advice/i,
  /legal (advice|question|requirements)/i,
  /salary|compensation|pay (range|scale)/i,
  /discrimination|diversity (quota|law)/i,
  /interview (tips|questions|guide)/i,
  /resume|cv review/i,
  /background check/i,
  /what (should|do) i (ask|wear|say) in an interview/i,
  /how to (negotiate|get hired|impress)/i,
];

const INJECTION_PATTERNS = [
  /ignore (all |previous |the |above |your )?(instructions?|rules?|prompt|system)/i,
  /forget (your |all |the )?instructions?/i,
  /you are now|act as|pretend (to be|you are|you're)/i,
  /disregard (your |all )?/i,
  /override (your |the )?(instructions?|system|rules?)/i,
  /jailbreak|DAN mode|developer mode/i,
  /repeat (after me|this text|everything)/i,
];

const COMPARE_PATTERNS = [
  /what('s| is) the difference between/i,
  /compare (.*) (and|with|vs|versus)/i,
  /how does (.*) differ/i,
  /(.*) vs\.? (.*)/i,
  /which is better between/i,
  /contrast (.*) and/i,
];

const VAGUE_PATTERNS = [
  /^(i need|we need|looking for|we('re| are) looking for|find me|give me|recommend|suggest|what('s| is)|can you)? ?an? assessment\.?$/i,
  /^(help|help me|assist|i need help)\.?$/i,
  /^what (assessment|test|tool)s? (do you have|are available|can you recommend)\??$/i,
  /^(start|begin|let('s| us) start|get started)\.?$/i,
];

const REFINEMENT_KEYWORDS = [
  "actually",
  "also add",
  "instead",
  "but also",
  "additionally",
  "change to",
  "update",
  "make it",
  "add personality",
  "add cognitive",
  "and also",
  "now add",
  "plus",
  "as well",
  "more specifically",
  "forget the",
  "remove",
  "without",
];

export function classifyIntent(messages: ChatMessage[]): Intent {
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  if (!lastUserMessage) return "vague";

  const content = lastUserMessage.content.trim();
  const contentLower = content.toLowerCase();

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) return "injection";
  }

  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(content)) return "off_topic";
  }

  for (const pattern of COMPARE_PATTERNS) {
    if (pattern.test(content)) return "compare";
  }

  const hasPriorContext = messages.filter((m) => m.role === "assistant").length > 0;

  if (hasPriorContext) {
    for (const kw of REFINEMENT_KEYWORDS) {
      if (contentLower.includes(kw)) return "refine";
    }
  }

  for (const pattern of VAGUE_PATTERNS) {
    if (pattern.test(content)) return "vague";
  }

  const hasRoleOrContext =
    /\b(developer|engineer|analyst|manager|director|executive|sales|HR|recruiter|accountant|designer|nurse|doctor|technician|clerk|agent|representative|trainee|graduate|intern|senior|junior|lead|VP|C-suite|CEO|CFO|CTO)\b/i.test(
      content,
    ) ||
    /\b(python|java|javascript|SQL|finance|marketing|operations|customer service|leadership|management|communication|coding|programming|technical|mechanical|verbal|numerical|personality|aptitude|cognitive|behavioural|behavioral|safety|integrity|motivation|skills?|experience)\b/i.test(
      content,
    );

  if (!hasRoleOrContext && content.split(" ").length < 6) return "vague";

  return hasPriorContext ? "refine" : "recommend";
}

export function extractComparedAssessments(message: string): string[] {
  const patterns = [
    /difference between\s+([A-Za-z0-9\s]+)\s+and\s+([A-Za-z0-9\s]+)/i,
    /compare\s+([A-Za-z0-9\s]+)\s+(?:and|with|vs\.?)\s+([A-Za-z0-9\s]+)/i,
    /([A-Za-z0-9\s]+)\s+vs\.?\s+([A-Za-z0-9\s]+)/i,
    /([A-Za-z0-9\s]+)\s+versus\s+([A-Za-z0-9\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return [match[1].trim(), match[2].trim()];
    }
  }

  return [];
}

export function buildQueryFromHistory(messages: ChatMessage[]): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  return userMessages;
}
