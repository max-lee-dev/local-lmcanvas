import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Bookmark,
  Box,
  Brain,
  Briefcase,
  Bug,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Cloud,
  Code2,
  Cog,
  Compass,
  Cpu,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  Flag,
  FlaskConical,
  Folder,
  Gauge,
  GitBranch,
  GitCommit,
  GitCompare,
  GitMerge,
  GitPullRequest,
  Globe,
  Hammer,
  HardDrive,
  Heart,
  HelpCircle,
  Image,
  Inbox,
  Key,
  Keyboard,
  Layers,
  Layout,
  Library,
  Lightbulb,
  Link as LinkIcon,
  ListChecks,
  Lock,
  type LucideIcon,
  Mail,
  Map,
  Megaphone,
  MessageSquare,
  Mic,
  Move,
  Music,
  Network,
  Package,
  Paintbrush,
  PenTool,
  Pencil,
  Phone,
  PieChart,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Scale,
  Scissors,
  Search,
  Send,
  Server,
  Settings,
  Share2,
  Shield,
  Shuffle,
  Sparkles,
  Star,
  Tag,
  Target,
  Terminal,
  Timer,
  Trash2,
  TrendingUp,
  Truck,
  Type,
  Undo2,
  Upload,
  User,
  Users,
  Wand2,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";

/** Keyword → icon. First match wins, so put more specific terms before generic ones. */
const RULES: { match: RegExp; icon: LucideIcon }[] = [
  { match: /\b(ship|release|publish|deploy|rollout|launch)\b/i, icon: Rocket },
  { match: /\b(commit|stage)\b/i, icon: GitCommit },
  { match: /\bmerge\b/i, icon: GitMerge },
  { match: /\b(pr|pull request|review)\b/i, icon: GitPullRequest },
  { match: /\b(branch|split|fork)\b/i, icon: GitBranch },
  { match: /\b(compare|diff)\b/i, icon: GitCompare },
  { match: /\b(spike|prototype|experiment|try|test)\b/i, icon: FlaskConical },
  { match: /\b(run|execute|start|kick off)\b/i, icon: Play },
  { match: /\b(fix|repair|patch|debug)\b/i, icon: Wrench },
  { match: /\b(bug|error|crash|failure)\b/i, icon: Bug },
  { match: /\b(warn|risk|danger|caution)\b/i, icon: AlertTriangle },
  { match: /\b(build|compile|bundle)\b/i, icon: Hammer },
  { match: /\b(refactor|simplify|clean|tidy)\b/i, icon: Sparkles },
  { match: /\b(add|create|new|generate|introduce)\b/i, icon: Plus },
  { match: /\b(remove|delete|drop|strip)\b/i, icon: Trash2 },
  { match: /\b(cut|trim|split)\b/i, icon: Scissors },
  { match: /\b(rename|edit|update|tweak|modify)\b/i, icon: Pencil },
  { match: /\b(inspect|audit|check)\b/i, icon: Eye },
  { match: /\b(search|find|locate|grep)\b/i, icon: Search },
  { match: /\b(explore|investigate|dig)\b/i, icon: Compass },
  { match: /\b(read|learn|understand|study)\b/i, icon: BookOpen },
  { match: /\b(docs?|documentation|readme)\b/i, icon: Library },
  { match: /\b(ask|clarify|question)\b/i, icon: HelpCircle },
  { match: /\b(plan|design|think|brainstorm|idea)\b/i, icon: Lightbulb },
  { match: /\b(reason|analy[sz]e|model)\b/i, icon: Brain },
  { match: /\b(list|enumerate|tasks?|todo|checklist)\b/i, icon: ListChecks },
  { match: /\b(optim|perf|speed|fast)/i, icon: Zap },
  { match: /\b(measure|metric|benchmark|profile)\b/i, icon: Gauge },
  { match: /\b(monitor|observ|watch|track)\b/i, icon: Activity },
  { match: /\b(trend|grow|increase|improv)/i, icon: TrendingUp },
  { match: /\b(chart|graph|stat)/i, icon: PieChart },
  { match: /\b(config|settings?|preferences?)\b/i, icon: Settings },
  { match: /\b(gear|cog|tooling)\b/i, icon: Cog },
  { match: /\b(code|implement|wire|hook)\b/i, icon: Code2 },
  { match: /\b(terminal|shell|cli|command)\b/i, icon: Terminal },
  { match: /\b(write|notes?|summary|draft)\b/i, icon: FileText },
  { match: /\b(confirm|approve|accept|ok|done|complete)\b/i, icon: CheckCircle2 },
  { match: /\b(undo|revert|rollback|restore)\b/i, icon: Undo2 },
  { match: /\b(refresh|reload|retry|reset)\b/i, icon: RefreshCw },
  { match: /\b(save|persist|store)\b/i, icon: Save },
  { match: /\b(download|fetch|pull)\b/i, icon: Download },
  { match: /\b(upload|push|publish)\b/i, icon: Upload },
  { match: /\b(send|email|notify)\b/i, icon: Send },
  { match: /\b(mail|inbox|message)\b/i, icon: Mail },
  { match: /\b(chat|reply|comment|discuss)\b/i, icon: MessageSquare },
  { match: /\b(call|phone|dial)\b/i, icon: Phone },
  { match: /\b(meeting|schedule|calendar|date)\b/i, icon: Calendar },
  { match: /\b(time|wait|delay|countdown)\b/i, icon: Clock },
  { match: /\b(timer|countdown|stopwatch)\b/i, icon: Timer },
  { match: /\b(user|profile|account|person)\b/i, icon: User },
  { match: /\b(team|users|group|members)\b/i, icon: Users },
  { match: /\b(secure|auth|protect|secret|password)\b/i, icon: Shield },
  { match: /\b(key|token|credential)\b/i, icon: Key },
  { match: /\b(lock|encrypt|private)\b/i, icon: Lock },
  { match: /\b(db|database|sql|query|table)\b/i, icon: Database },
  { match: /\b(api|server|backend|service)\b/i, icon: Server },
  { match: /\b(network|connect|graph)\b/i, icon: Network },
  { match: /\b(storage|disk|drive)\b/i, icon: HardDrive },
  { match: /\b(cloud|remote|hosted)\b/i, icon: Cloud },
  { match: /\b(web|browser|site|url|link)\b/i, icon: Globe },
  { match: /\b(image|photo|picture|screenshot)\b/i, icon: Image },
  { match: /\b(audio|voice|sound|record)\b/i, icon: Mic },
  { match: /\b(music|song|track)\b/i, icon: Music },
  { match: /\b(camera|video)\b/i, icon: Camera },
  { match: /\b(file|document)\b/i, icon: FileText },
  { match: /\b(folder|directory|dir)\b/i, icon: Folder },
  { match: /\b(layer|stack|level)\b/i, icon: Layers },
  { match: /\b(layout|grid|arrange|position)\b/i, icon: Layout },
  { match: /\b(map|navigate|route)\b/i, icon: Map },
  { match: /\b(filter|sort|narrow)\b/i, icon: Filter },
  { match: /\b(tag|label|annotate)\b/i, icon: Tag },
  { match: /\b(pin|fix|attach)\b/i, icon: Pin },
  { match: /\b(bookmark|save for later)\b/i, icon: Bookmark },
  { match: /\b(star|favorite|like)\b/i, icon: Star },
  { match: /\b(heart|love|enjoy)\b/i, icon: Heart },
  { match: /\b(target|goal|objective|aim)\b/i, icon: Target },
  { match: /\b(flag|mark|priorit)/i, icon: Flag },
  { match: /\b(award|achievement|win)\b/i, icon: Award },
  { match: /\b(work|job|project)\b/i, icon: Briefcase },
  { match: /\b(workflow|pipeline|process|flow)\b/i, icon: Workflow },
  { match: /\b(share|distribute|export)\b/i, icon: Share2 },
  { match: /\b(notify|alert|ping|remind)\b/i, icon: Bell },
  { match: /\b(announce|broadcast)\b/i, icon: Megaphone },
  { match: /\b(box|container|wrapper)\b/i, icon: Box },
  { match: /\b(package|module|dependency)\b/i, icon: Package },
  { match: /\b(ship|deliver|transport)\b/i, icon: Truck },
  { match: /\b(archive|backup|snapshot)\b/i, icon: Archive },
  { match: /\b(inbox|queue)\b/i, icon: Inbox },
  { match: /\b(magic|auto|smart)\b/i, icon: Wand2 },
  { match: /\b(cpu|process|compute|memory)\b/i, icon: Cpu },
  { match: /\b(shuffle|random|reorder)\b/i, icon: Shuffle },
  { match: /\b(scale|balance|weigh)\b/i, icon: Scale },
  { match: /\b(move|drag|reposition)\b/i, icon: Move },
  { match: /\b(font|type|typography|text)\b/i, icon: Type },
  { match: /\b(paint|color|style|theme)\b/i, icon: Paintbrush },
  { match: /\b(draw|sketch|illustrate)\b/i, icon: PenTool },
  { match: /\b(plan|outline|board)\b/i, icon: ClipboardList },
  { match: /\b(shortcut|keybind|hotkey)\b/i, icon: Keyboard },
  { match: /\b(connect|join|relate|reference)\b/i, icon: LinkIcon },
];

/** Fallback pool — used when keyword matching gives nothing OR when a keyword
 *  match collides with an already-picked icon. Picked deterministically by
 *  hashing the label, so the same label always gets the same fallback. */
const FALLBACK_POOL: LucideIcon[] = [
  ArrowRight,
  Sparkles,
  Lightbulb,
  Compass,
  Target,
  Wand2,
  Brain,
  Zap,
  Eye,
  FlaskConical,
  Layers,
  Workflow,
  Activity,
  Gauge,
  Map,
  Shuffle,
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Candidates for a label, in preference order: all keyword matches first,
 *  then a hash-rotated walk of the fallback pool. */
function candidatesFor(label: string): LucideIcon[] {
  const matched: LucideIcon[] = [];
  const seen = new Set<LucideIcon>();
  for (const { match, icon } of RULES) {
    if (!match.test(label) || seen.has(icon)) continue;
    matched.push(icon);
    seen.add(icon);
  }
  const start = hashSeed(label) % FALLBACK_POOL.length;
  for (let i = 0; i < FALLBACK_POOL.length; i++) {
    const icon = FALLBACK_POOL[(start + i) % FALLBACK_POOL.length];
    if (seen.has(icon)) continue;
    matched.push(icon);
    seen.add(icon);
  }
  return matched;
}

/** Pick one icon per label such that, within the returned array, no two
 *  icons are the same (when avoidable). Order of `labels` is preserved. */
export function pickSuggestionIcons(labels: string[]): LucideIcon[] {
  const used = new Set<LucideIcon>();
  const result: LucideIcon[] = [];
  for (const label of labels) {
    const cands = candidatesFor(label);
    const pick = cands.find((c) => !used.has(c)) ?? cands[0] ?? ArrowRight;
    used.add(pick);
    result.push(pick);
  }
  return result;
}
