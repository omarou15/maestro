"use client"

import Header from "@/components/Header"
import NavBar from "@/components/NavBar"

const SKILLS = [
  {
    id: "coding-agent",
    name: "Coding Agent",
    icon: "💻",
    description: "Delegate coding tasks to Codex, Claude Code, or Pi agents via background process",
    triggers: "Building features, reviewing PRs, refactoring large codebases",
    available: true,
    category: "Development",
  },
  {
    id: "weather",
    name: "Weather",
    icon: "🌤️",
    description: "Get current weather and forecasts via wttr.in or Open-Meteo",
    triggers: "Weather questions, temperature, forecasts for any location",
    available: true,
    category: "Utility",
  },
  {
    id: "healthcheck",
    name: "Security Healthcheck",
    icon: "🔒",
    description: "Host security hardening and risk-tolerance configuration",
    triggers: "Security audits, firewall/SSH hardening, exposure review",
    available: true,
    category: "Security",
  },
  {
    id: "skill-creator",
    name: "Skill Creator",
    icon: "🔧",
    description: "Create, edit, improve, or audit AgentSkills",
    triggers: "Creating/improving skills, reviewing SKILL.md files",
    available: true,
    category: "Meta",
  },
  {
    id: "tmux",
    name: "Tmux Control",
    icon: "🖥️",
    description: "Remote-control tmux sessions for interactive CLIs",
    triggers: "Controlling interactive terminal sessions, sending keystrokes",
    available: true,
    category: "System",
  },
  {
    id: "web-research",
    name: "Web Research",
    icon: "🔍",
    description: "Deep web research with fact-checking and source validation",
    triggers: "Complex research questions, fact-checking, competitive analysis",
    available: false,
    category: "Research",
  },
  {
    id: "document-analysis",
    name: "Document Analysis",
    icon: "📄",
    description: "Analyze PDFs, contracts, reports with structured extraction",
    triggers: "PDF analysis, contract review, report summarization",
    available: false,
    category: "Analysis",
  },
  {
    id: "browser-automation",
    name: "Browser Automation",
    icon: "🌐",
    description: "Automate web tasks: scraping, form filling, testing",
    triggers: "Web automation, form filling, UI testing, scraping",
    available: false,
    category: "Automation",
  },
]

const CATEGORIES = Array.from(new Set(SKILLS.map(s => s.category)))

export default function SkillsPage() {
  return (
    <div className="min-h-screen bg-[var(--maestro-cream)]">
      <Header subtitle="SKILLS SYSTEM" />
      <NavBar />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-[var(--maestro-border)] p-6">
          <h1 className="text-2xl font-bold text-[var(--maestro-primary)] mb-2">🔧 Agent Skills</h1>
          <p className="text-sm text-[var(--maestro-muted)]">
            Specialized capabilities powered by OpenClaw's skill system. Each skill is self-contained and reusable.
          </p>
        </div>

        {/* Skills by Category */}
        {CATEGORIES.map(category => {
          const categorySkills = SKILLS.filter(s => s.category === category)
          return (
            <div key={category} className="space-y-3">
              <h2 className="text-lg font-bold text-[var(--maestro-primary)] flex items-center gap-2">
                <span className="text-[var(--maestro-accent)]">▶</span>
                {category}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categorySkills.map(skill => (
                  <div
                    key={skill.id}
                    className={`bg-white rounded-2xl border p-6 transition-all ${
                      skill.available
                        ? "border-green-200 hover:border-green-400 cursor-pointer"
                        : "border-gray-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl shrink-0">{skill.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-bold text-[var(--maestro-primary)]">{skill.name}</div>
                          {skill.available ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              Available
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              Planned
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--maestro-muted)] mb-3">
                          {skill.description}
                        </p>
                        <div className="text-xs text-[var(--maestro-muted)]">
                          <span className="font-semibold">Triggers:</span> {skill.triggers}
                        </div>
                      </div>
                    </div>

                    {skill.available && (
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                        <button className="text-xs bg-[var(--maestro-accent)] text-white px-3 py-1.5 rounded-lg hover:bg-[var(--maestro-accent-light)] transition-colors font-semibold">
                          Use Skill
                        </button>
                        <button className="text-xs bg-white text-[var(--maestro-primary)] border border-[var(--maestro-border)] px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                          View SKILL.md
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* How Skills Work */}
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="font-bold text-blue-900 mb-2">How Skills Work</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              Skills are specialized instructions stored in <code>SKILL.md</code> files. When triggered,
              I read the relevant skill and follow its instructions precisely.
            </p>
            <p>
              <strong>Automatic:</strong> I scan available skills before replying and select the most relevant one.
            </p>
            <p>
              <strong>Reusable:</strong> Skills can be shared, versioned, and improved over time.
            </p>
            <p>
              <strong>Self-contained:</strong> Each skill includes its own documentation, scripts, and references.
            </p>
          </div>
        </div>

        {/* Create New Skill */}
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div className="flex-1">
              <div className="font-semibold text-amber-900 mb-1">Want a new skill?</div>
              <div className="text-sm text-amber-800">
                Use the <strong>skill-creator</strong> skill to design and implement new capabilities.
                Say "create a skill for [task]" in conversation.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
