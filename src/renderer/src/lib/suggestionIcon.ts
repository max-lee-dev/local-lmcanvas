import {
  ArrowRight,
  BookOpen,
  Bug,
  CheckCircle2,
  Code2,
  Eye,
  FileText,
  FlaskConical,
  GitBranch,
  GitCommit,
  GitCompare,
  GitMerge,
  Hammer,
  HelpCircle,
  Lightbulb,
  ListChecks,
  type LucideIcon,
  Pencil,
  Play,
  Plus,
  Rocket,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";

/** Keyword → icon. First match wins, so put more specific terms before generic ones. */
const RULES: { match: RegExp; icon: LucideIcon }[] = [
  { match: /\b(ship|release|publish|deploy|rollout)\b/i, icon: Rocket },
  { match: /\b(commit|stage)\b/i, icon: GitCommit },
  { match: /\bmerge\b/i, icon: GitMerge },
  { match: /\b(branch|split|fork)\b/i, icon: GitBranch },
  { match: /\b(compare|diff)\b/i, icon: GitCompare },
  { match: /\b(spike|prototype|experiment|try|test)\b/i, icon: FlaskConical },
  { match: /\b(run|execute|start|kick off)\b/i, icon: Play },
  { match: /\b(fix|repair|patch|debug)\b/i, icon: Wrench },
  { match: /\b(bug|error|crash|failure)\b/i, icon: Bug },
  { match: /\b(build|compile|bundle)\b/i, icon: Hammer },
  { match: /\b(refactor|simplify|clean)\b/i, icon: Sparkles },
  { match: /\b(add|create|new|generate|introduce)\b/i, icon: Plus },
  { match: /\b(remove|delete|drop|strip)\b/i, icon: Trash2 },
  { match: /\b(rename|edit|update|tweak|modify)\b/i, icon: Pencil },
  { match: /\b(review|inspect|audit|check)\b/i, icon: Eye },
  { match: /\b(search|find|locate|grep)\b/i, icon: Search },
  { match: /\b(explore|investigate|dig)\b/i, icon: Search },
  { match: /\b(read|learn|understand|docs?)\b/i, icon: BookOpen },
  { match: /\b(ask|clarify|question)\b/i, icon: HelpCircle },
  { match: /\b(plan|design|think|brainstorm|idea)\b/i, icon: Lightbulb },
  { match: /\b(list|enumerate|tasks?|todo)\b/i, icon: ListChecks },
  { match: /\b(optim|perf|speed|fast)/i, icon: Zap },
  { match: /\b(config|settings?|preferences?)\b/i, icon: Settings },
  { match: /\b(code|implement|wire)\b/i, icon: Code2 },
  { match: /\b(doc|write|notes?|summary)\b/i, icon: FileText },
  { match: /\b(confirm|approve|accept|ok|done)\b/i, icon: CheckCircle2 },
];

export function iconForSuggestion(label: string): LucideIcon {
  for (const { match, icon } of RULES) {
    if (match.test(label)) return icon;
  }
  return ArrowRight;
}
