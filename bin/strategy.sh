#!/usr/bin/env bash
# Interactive wizard that defines the AI strategy for this project and writes
# STRATEGY.md to the repo root. Re-run at any time to change the strategy, or
# edit STRATEGY.md by hand.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="$ROOT_DIR/STRATEGY.md"
PROJECT_NAME="$(basename "$ROOT_DIR")"

# ---------------------------------------------------------------------------
# colors
# ---------------------------------------------------------------------------
RESET=$'\033[0m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
GREEN=$'\033[32m'
BLUE=$'\033[34m'
ORANGE=$'\033[33m'
RED=$'\033[31m'
GRAY=$'\033[90m'
CYAN=$'\033[36m'
MAGENTA=$'\033[35m'

INTERACTIVE=1
[[ -t 0 && -t 1 ]] || INTERACTIVE=0

hide_cursor() { [[ $INTERACTIVE -eq 1 ]] && printf '\033[?25l' || true; }
show_cursor() { [[ $INTERACTIVE -eq 1 ]] && printf '\033[?25h' || true; }
cleanup() { show_cursor; }
trap cleanup EXIT

# ---------------------------------------------------------------------------
# key reading
# ---------------------------------------------------------------------------
read_key() {
  local key rest
  IFS= read -rsn1 key || true
  if [[ $key == $'\x1b' ]]; then
    IFS= read -rsn2 rest || true
    case "$rest" in
      '[A') printf 'UP' ;;
      '[B') printf 'DOWN' ;;
      *) printf 'OTHER' ;;
    esac
  elif [[ -z ${key:-} ]]; then
    printf 'ENTER'
  elif [[ $key == ' ' ]]; then
    printf 'SPACE'
  else
    printf 'OTHER'
  fi
}

# ---------------------------------------------------------------------------
# intro
# ---------------------------------------------------------------------------
print_intro() {
  echo -e "${BOLD}Let's define the AI strategy for this project.${RESET}"
  echo "This will determine:"
  echo " - git branching strategy"
  echo " - which steps require your manual intervention / work"
  echo " - what artifacts are created as we go"
  echo "The strategy can be changed at any point by re-running this command,"
  echo "or by editing STRATEGY.md manually."
  echo
}

# ---------------------------------------------------------------------------
# workflow choice (single select)
# ---------------------------------------------------------------------------
WORKFLOW_OPTIONS=(
  "commit to main"
  "branch each feature off main and create pull requests"
)
workflow_selected=0

select_workflow() {
  echo -e "${BOLD}Please choose a workflow${RESET}"
  echo

  if [[ $INTERACTIVE -eq 0 ]]; then
    echo -e "  ${GREEN}[x]${RESET} ${WORKFLOW_OPTIONS[0]}  ${DIM}(default, non-interactive)${RESET}"
    echo -e "  [ ] ${WORKFLOW_OPTIONS[1]}"
    workflow_selected=0
    echo
    return
  fi

  local count=${#WORKFLOW_OPTIONS[@]}
  local idx=0
  local first_draw=1

  while true; do
    if [[ $first_draw -eq 0 ]]; then
      tput cuu "$count"
      tput ed
    fi
    first_draw=0
    local i
    for i in "${!WORKFLOW_OPTIONS[@]}"; do
      if [[ $i -eq $idx ]]; then
        echo -e "  ${CYAN}>${RESET} ${GREEN}[x]${RESET} ${WORKFLOW_OPTIONS[$i]}"
      else
        echo -e "    [ ] ${WORKFLOW_OPTIONS[$i]}"
      fi
    done

    local key
    key=$(read_key)
    case "$key" in
      UP) idx=$(( (idx - 1 + count) % count )) ;;
      DOWN) idx=$(( (idx + 1) % count )) ;;
      ENTER) break ;;
    esac
  done
  workflow_selected=$idx
  echo
}

# ---------------------------------------------------------------------------
# generic grouped checkbox list (used for both the steps menu and the
# artifacts menu, one at a time - build the items, run the menu, then snapshot
# the results out of ITEM_* before reusing it for the next menu)
# ---------------------------------------------------------------------------
ITEM_LABEL=()
ITEM_PHASE=()
ITEM_CHECKED=()
ITEM_DISABLED=()
ITEM_HEADER=()
ITEM_NOTE=()
ITEM_KEY=()

reset_items() {
  ITEM_LABEL=(); ITEM_PHASE=(); ITEM_CHECKED=(); ITEM_DISABLED=(); ITEM_HEADER=(); ITEM_NOTE=(); ITEM_KEY=()
}
add_header() {
  ITEM_LABEL+=("$1"); ITEM_PHASE+=("$2")
  ITEM_CHECKED+=(0); ITEM_DISABLED+=(0); ITEM_HEADER+=(1); ITEM_NOTE+=(""); ITEM_KEY+=("")
}
add_item() {
  # label phase default_checked disabled note [key]
  ITEM_LABEL+=("$1"); ITEM_PHASE+=("$2")
  ITEM_CHECKED+=("$3"); ITEM_DISABLED+=("$4"); ITEM_HEADER+=(0); ITEM_NOTE+=("$5")
  ITEM_KEY+=("${6:-}")
}

build_steps() {
  local pr_enabled=$workflow_selected # 1 = branch+PR workflow, 0 = commit to main
  local pr_disabled=$((1 - pr_enabled))

  add_header "PHASE 1 - SPEC" 1
  add_item "research"              1 0 0 ""
  add_item "spec"                  1 1 0 ""
  add_item "spec review"           1 0 0 ""
  add_item "spec validation"       1 1 0 ""
  add_item "spec revision"         1 0 0 "(loop until pass)"
  add_item "commit"                1 0 0 ""
  add_item "push & pull request"   1 0 "$pr_disabled" ""

  add_header "PHASE 2 - TASKS" 2
  add_item "tasks"                 2 0 0 ""
  add_item "review tasks"          2 0 0 ""
  add_item "validate tasks"        2 1 0 ""
  add_item "task revision"         2 0 0 "(loop until pass)"
  add_item "commit"                2 0 0 ""
  add_item "push & pull request"   2 0 "$pr_disabled" ""

  add_header "PHASE 3 - IMPLEMENTATION" 3
  add_item "write tests"           3 0 0 ""
  add_item "implement feature"     3 0 0 ""
  add_item "run tests"             3 0 0 ""
  add_item "fix"                   3 0 0 "(loop until pass)"
  add_item "commit"                3 0 0 ""
  add_item "push & pull request"   3 0 "$pr_disabled" ""

  add_header "PHASE 4 - REVIEW" 4
  add_item "review"                4 0 0 ""
  add_item "commit review"         4 0 0 ""
  add_item "PR validation"         4 1 0 ""
  add_item "request changes"       4 0 0 "(loop until pass)"
  add_item "revision"              4 0 0 "(loop until pass)"
  add_item "commit revision"       4 0 0 "(loop until pass)"
  add_item "merge pull request"    4 0 "$pr_disabled" ""
}

snapshot_steps() {
  STEP_LABEL=("${ITEM_LABEL[@]}")
  STEP_PHASE=("${ITEM_PHASE[@]}")
  STEP_CHECKED=("${ITEM_CHECKED[@]}")
  STEP_DISABLED=("${ITEM_DISABLED[@]}")
  STEP_HEADER=("${ITEM_HEADER[@]}")
  STEP_NOTE=("${ITEM_NOTE[@]}")
}

# ---------------------------------------------------------------------------
# artifacts checklist (multi select, grouped by phase)
# ---------------------------------------------------------------------------
build_artifacts() {
  add_header "ALL PHASES" 0
  add_item "progress.md"                          0 1 0 "" progress
  add_item "book (chapters + final book file)"    0 1 0 "" book

  add_header "PHASE 1 - SPEC" 1
  add_item "research.md"                          1 1 0 "" research
  add_item "spec.md"                               1 1 0 "" spec
  add_item "spec review log"                       1 1 0 "" spec_review_log
  add_item "spec revision changelog"               1 1 0 "" spec_revision_log

  add_header "PHASE 2 - TASKS" 2
  add_item "tasks.md"                              2 1 0 "" tasks
  add_item "task review log"                       2 1 0 "" task_review_log

  add_header "PHASE 3 - IMPLEMENTATION" 3
  add_item "implementation changelog"              3 1 0 "" impl_log
  add_item "test log"                              3 1 0 "" tests_log

  add_header "PHASE 4 - REVIEW" 4
  add_item "review log"                            4 1 0 "" review_log
  add_item "revision changelog"                    4 1 0 "" revision_log
}

declare -A ARTF_CHECKED
snapshot_artifacts() {
  ARTF_CHECKED=()
  local n=${#ITEM_LABEL[@]} i
  for ((i = 0; i < n; i++)); do
    if [[ ${ITEM_HEADER[$i]} -eq 0 ]]; then
      ARTF_CHECKED["${ITEM_KEY[$i]}"]=${ITEM_CHECKED[$i]}
    fi
  done
}

is_checked() { [[ ${ARTF_CHECKED[$1]:-0} -eq 1 ]]; }

phase_color() {
  case "$1" in
    0) echo -n "$RED" ;;
    1) echo -n "$GREEN" ;;
    2) echo -n "$MAGENTA" ;;
    3) echo -n "$BLUE" ;;
    4) echo -n "$ORANGE" ;;
  esac
}

render_steps() {
  local cursor=$1
  local n=${#ITEM_LABEL[@]}
  local i color box label
  for ((i = 0; i < n; i++)); do
    if [[ ${ITEM_HEADER[$i]} -eq 1 ]]; then
      color=$(phase_color "${ITEM_PHASE[$i]}")
      echo -e "${color}${BOLD}${ITEM_LABEL[$i]}${RESET}"
      continue
    fi

    if [[ ${ITEM_DISABLED[$i]} -eq 1 ]]; then
      box="${GRAY}[N/A]${RESET}"
      label="${GRAY}${ITEM_LABEL[$i]} ${ITEM_NOTE[$i]}${RESET}"
    elif [[ ${ITEM_CHECKED[$i]} -eq 1 ]]; then
      box="${GREEN}[x]${RESET}"
      label="${ITEM_LABEL[$i]} ${DIM}${ITEM_NOTE[$i]}${RESET}"
    else
      box="[ ]"
      label="${ITEM_LABEL[$i]} ${DIM}${ITEM_NOTE[$i]}${RESET}"
    fi

    if [[ $i -eq $cursor ]]; then
      echo -e "  ${CYAN}>${RESET} ${box} ${label}"
    else
      echo -e "    ${box} ${label}"
    fi
  done
}

first_focusable() {
  local n=${#ITEM_LABEL[@]}
  local i
  for ((i = 0; i < n; i++)); do
    if [[ ${ITEM_HEADER[$i]} -eq 0 && ${ITEM_DISABLED[$i]} -eq 0 ]]; then
      echo "$i"
      return
    fi
  done
  echo 0
}

checkbox_menu() {
  local title="$1" subtitle="$2"
  echo -e "${BOLD}${title}${RESET}"
  [[ -n $subtitle ]] && echo -e "${DIM}${subtitle}${RESET}"
  echo

  local n=${#ITEM_LABEL[@]}

  if [[ $INTERACTIVE -eq 0 ]]; then
    render_steps -1
    echo
    return
  fi

  echo -e "${DIM}↑/↓ move   space toggle   enter confirm${RESET}"
  echo

  local idx first_draw=1
  idx=$(first_focusable)

  while true; do
    if [[ $first_draw -eq 0 ]]; then
      tput cuu "$n"
      tput ed
    fi
    first_draw=0
    render_steps "$idx"

    local key j
    key=$(read_key)
    case "$key" in
      UP)
        j=$idx
        while true; do
          j=$(( (j - 1 + n) % n ))
          if [[ ${ITEM_HEADER[$j]} -eq 0 && ${ITEM_DISABLED[$j]} -eq 0 ]]; then idx=$j; break; fi
        done
        ;;
      DOWN)
        j=$idx
        while true; do
          j=$(( (j + 1) % n ))
          if [[ ${ITEM_HEADER[$j]} -eq 0 && ${ITEM_DISABLED[$j]} -eq 0 ]]; then idx=$j; break; fi
        done
        ;;
      SPACE)
        if [[ ${ITEM_CHECKED[$idx]} -eq 1 ]]; then ITEM_CHECKED[$idx]=0; else ITEM_CHECKED[$idx]=1; fi
        ;;
      ENTER) break ;;
    esac
  done
  echo
}

# ---------------------------------------------------------------------------
# book notice (informational, not a question)
# ---------------------------------------------------------------------------
print_book_notice() {
  echo "As we go I'll write a book, taking you through this project step by step"
  echo "with code samples, each feature will be it's own chapter."
  echo "This book will be saved as a single Markdown file, but each pull request"
  echo "will also include its relevant chapter."
  echo "(you can turn this off below, along with any other artifact)"
  echo
}

# ---------------------------------------------------------------------------
# artifacts tree - shared renderer, used both for the coloured terminal
# summary and the plain block written into STRATEGY.md. Only includes lines
# for artifacts the user left checked in the artifacts menu.
# ---------------------------------------------------------------------------
connector() { [[ "$1" -eq $(( $2 - 1 )) ]] && echo -n "└─" || echo -n "├─"; }
cont_prefix() { [[ "$1" -eq $(( $2 - 1 )) ]] && echo -n "   " || echo -n "│  "; }

render_artifact_tree() {
  local mode=$1 # color | plain
  local c0="" c1="" c2="" c3="" c4="" rst="" t0="" t1="" t2="" t3="" t4=""
  if [[ $mode == color ]]; then
    c0=$RED; c1=$GREEN; c2=$MAGENTA; c3=$BLUE; c4=$ORANGE; rst=$RESET
  else
    t0=" [all phases]"; t1=" [phase 1]"; t2=" [phase 2]"; t3=" [phase 3]"; t4=" [phase 4]"
  fi

  local root_keys=()
  is_checked progress && root_keys+=(progress)
  is_checked book && root_keys+=(books)
  root_keys+=(docs)
  { is_checked research || is_checked spec || is_checked tasks; } && root_keys+=(specs)

  echo "artifacts/"
  local n=${#root_keys[@]} i conn cont
  for ((i = 0; i < n; i++)); do
    conn=$(connector "$i" "$n")
    case "${root_keys[$i]}" in
      progress)
        echo -e "${conn} ${c0}progress.md${t0}${rst}"
        ;;
      books)
        echo -e "${conn} books/"
        cont=$(cont_prefix "$i" "$n")
        echo -e "${cont}└─ ${c0}${PROJECT_NAME}.md${t0}${rst}"
        ;;
      docs)
        echo -e "${conn} docs/"
        ;;
      specs)
        echo -e "${conn} specs/"
        cont=$(cont_prefix "$i" "$n")
        echo -e "${cont}└─ <feat name>/"
        local sk=()
        is_checked research && sk+=(research)
        is_checked spec && sk+=(spec)
        is_checked tasks && sk+=(tasks)
        local sn=${#sk[@]} si sconn
        for ((si = 0; si < sn; si++)); do
          sconn=$(connector "$si" "$sn")
          case "${sk[$si]}" in
            research) echo -e "${cont}   ${sconn} ${c1}research.md${t1}${rst}" ;;
            spec) echo -e "${cont}   ${sconn} ${c1}spec.md${t1}${rst}" ;;
            tasks) echo -e "${cont}   ${sconn} ${c2}tasks.md${t2}${rst}" ;;
          esac
        done
        ;;
    esac
  done

  local log_keys=()
  is_checked spec_review_log && log_keys+=(spec_review_log)
  is_checked spec_revision_log && log_keys+=(spec_revision_log)
  is_checked book && log_keys+=(book_p1)
  is_checked task_review_log && log_keys+=(task_review_log)
  is_checked book && log_keys+=(book_p2)
  is_checked impl_log && log_keys+=(impl_log)
  is_checked tests_log && log_keys+=(tests_log)
  is_checked book && log_keys+=(book_p3)
  is_checked review_log && log_keys+=(review_log)
  is_checked revision_log && log_keys+=(revision_log)
  is_checked book && log_keys+=(book_p4)

  echo "logs/"
  if [[ ${#log_keys[@]} -gt 0 ]]; then
    echo "└─ <feat name>/"
    local ln=${#log_keys[@]} li lconn
    for ((li = 0; li < ln; li++)); do
      lconn=$(connector "$li" "$ln")
      case "${log_keys[$li]}" in
        spec_review_log) echo -e "   ${lconn} ${c1}<timestamp>--spec-review--<PASS|FAIL>.md${t1}${rst}" ;;
        spec_revision_log) echo -e "   ${lconn} ${c1}<timestamp>--spec-revision-changelog.md${t1}${rst}" ;;
        book_p1) echo -e "   ${lconn} ${c1}<timestamp>--book-changelog.md${t1}${rst}" ;;
        task_review_log) echo -e "   ${lconn} ${c2}<timestamp>--task-review--<PASS|FAIL>.md${t2}${rst}" ;;
        book_p2) echo -e "   ${lconn} ${c2}<timestamp>--book-changelog.md${t2}${rst}" ;;
        impl_log) echo -e "   ${lconn} ${c3}<timestamp>--implementation-changelog.md${t3}${rst}" ;;
        tests_log) echo -e "   ${lconn} ${c3}<timestamp>--tests--<PASS|FAIL>.md${t3}${rst}" ;;
        book_p3) echo -e "   ${lconn} ${c3}<timestamp>--book-changelog.md${t3}${rst}" ;;
        review_log) echo -e "   ${lconn} ${c4}<timestamp>--review--<PASS|FAIL>.md${t4}${rst}" ;;
        revision_log) echo -e "   ${lconn} ${c4}<timestamp>--revision-changelog.md${t4}${rst}" ;;
        book_p4) echo -e "   ${lconn} ${c4}<timestamp>--book-changelog.md${t4}${rst}" ;;
      esac
    done
  fi
}

print_artifacts_summary() {
  echo -e "${BOLD}Artifacts that will be created as we go${RESET}"
  echo -e "${GREEN}Created during PHASE 1 - SPEC${RESET}"
  echo -e "${MAGENTA}Created during PHASE 2 - TASKS${RESET}"
  echo -e "${BLUE}Created during PHASE 3 - IMPLEMENTATION${RESET}"
  echo -e "${ORANGE}Created during PHASE 4 - REVIEW${RESET}"
  echo -e "${RED}Created/updated during ALL PHASES${RESET}"
  echo
  render_artifact_tree color
  echo
}

# ---------------------------------------------------------------------------
# STRATEGY.md generation
# ---------------------------------------------------------------------------
step_status_line() {
  local i=$1
  local label=${STEP_LABEL[$i]} note=${STEP_NOTE[$i]}
  local status
  if [[ ${STEP_DISABLED[$i]} -eq 1 ]]; then
    status="N/A (not used with this workflow)"
  elif [[ ${STEP_CHECKED[$i]} -eq 1 ]]; then
    status="**Manual**"
  else
    status="Automated (AI)"
  fi
  if [[ -n $note ]]; then
    echo "- ${label} ${note} — ${status}"
  else
    echo "- ${label} — ${status}"
  fi
}

write_strategy_md() {
  local workflow_desc=${WORKFLOW_OPTIONS[$workflow_selected]}
  local generated_at
  generated_at="$(date +"%Y-%m-%d %H:%M:%S %z")"

  {
    echo "# AI Strategy"
    echo
    echo "_Generated by \`bin/strategy.sh\` on ${generated_at}. Re-run the script to"
    echo "change these choices, or edit this file directly._"
    echo
    echo "## Git branching strategy"
    echo
    echo "**${workflow_desc}**"
    echo
    if [[ $workflow_selected -eq 0 ]]; then
      echo "All work is committed directly to \`main\`. There are no feature branches"
      echo "and no pull requests, so PR-related steps below are marked N/A."
    else
      echo "Each feature is developed on its own branch off \`main\` and merged via a"
      echo "pull request."
    fi
    echo

    echo "## Manual vs automated steps"
    echo
    echo "Everything not marked **Manual** is done by AI without asking."
    echo

    local n=${#STEP_LABEL[@]}
    local i
    for ((i = 0; i < n; i++)); do
      if [[ ${STEP_HEADER[$i]} -eq 1 ]]; then
        echo
        echo "### ${STEP_LABEL[$i]}"
        echo
        continue
      fi
      step_status_line "$i"
    done
    echo

    echo "## Book"
    echo
    if is_checked book; then
      echo "As the project progresses, a book is written taking the reader through the"
      echo "project step by step with code samples — each feature is its own chapter."
      echo "The book is saved as a single Markdown file at \`artifacts/books/${PROJECT_NAME}.md\`,"
      echo "and each pull request includes its relevant chapter."
    else
      echo "Disabled — no book or per-phase chapter changelogs are written."
    fi
    echo

    echo "## Artifacts"
    echo
    echo "Only artifacts left checked in the artifacts menu are listed below;"
    echo "anything unchecked is not written to disk."
    echo "Colour key (in the terminal wizard): green = PHASE 1 - SPEC,"
    echo "magenta = PHASE 2 - TASKS, blue = PHASE 3 - IMPLEMENTATION,"
    echo "orange = PHASE 4 - REVIEW, red = created/updated during all phases."
    echo
    echo '```'
    render_artifact_tree plain
    echo '```'
  } > "$OUT_FILE"
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
main() {
  hide_cursor
  print_intro
  select_workflow

  build_steps
  checkbox_menu "Which steps would you like to do manually?" "(everything else is done by AI)"
  snapshot_steps
  reset_items

  print_book_notice

  build_artifacts
  checkbox_menu "Which artifacts would you like generated?" "(untick anything you don't want written to disk)"
  snapshot_artifacts
  reset_items

  print_artifacts_summary
  write_strategy_md
  show_cursor

  echo -e "${BOLD}Wrote ${OUT_FILE#$ROOT_DIR/}${RESET}"
}

main "$@"