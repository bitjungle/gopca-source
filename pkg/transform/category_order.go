// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// GoPCA Suite is source-available software with free binary redistribution.
// Official compiled binary releases may be used and redistributed free of charge
// under the GoPCA Suite Source-Available Freeware License.
//
// The source code is provided for viewing, review, education, security analysis,
// research, interoperability analysis, and evaluation only.
//
// Modification, redistribution, publication, sublicensing, reuse, incorporation
// into another project, or creation of derivative works based on the source code
// is not permitted without prior written permission from the copyright holder.
//
// Usage Restriction: GoPCA Suite may not be used, directly or indirectly, for
// military, warfare, weapons, intelligence, surveillance, targeting, or
// law-enforcement surveillance applications.
//
// See LICENSE for the full license terms.

package transform

import (
	"sort"
	"strings"
)

// knownSequences are category vocabularies with a conventional order, used to
// pre-fill the ordering control rather than to decide anything.
//
// English and Norwegian are covered. Matching is case-insensitive and the
// values are returned as the user wrote them, so "Høy" is recognised and stays
// "Høy".
//
// Alphabetical order is wrong for most of these -- "high, low, medium" is the
// standard example -- so a user starting from an alphabetical list has to
// notice the problem and fix it by hand every time. Starting from the
// conventional order instead makes the common cases correct on sight.
//
// This is a suggestion and nothing more. The order is shown in the dialog and
// the user can change it, because these vocabularies are also used with other
// meanings: "small, medium, large" is a size scale in one dataset and three
// unordered site names in another, and no table can tell which.
var knownSequences = [][]string{
	{"low", "medium", "high"},
	{"low", "med", "high"},
	{"very low", "low", "medium", "high", "very high"},
	{"small", "medium", "large"},
	{"xs", "s", "m", "l", "xl", "xxl"},
	{"poor", "fair", "good", "very good", "excellent"},
	{"never", "rarely", "sometimes", "often", "always"},
	{"strongly disagree", "disagree", "neutral", "agree", "strongly agree"},
	{"cold", "warm", "hot"},
	{"none", "mild", "moderate", "severe"},
	{"primary", "secondary", "tertiary"},
	{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"},
	{"mon", "tue", "wed", "thu", "fri", "sat", "sun"},
	{
		"january", "february", "march", "april", "may", "june",
		"july", "august", "september", "october", "november", "december",
	},
	{"jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"},

	// Norwegian. Both written standards are covered where they differ:
	// bokmål "høy" against nynorsk "høg", and likewise "sjelden"/"sjeldan".
	//
	// The English sequences above are tried first, but that costs nothing here.
	// A match requires every value to be in the same vocabulary, so a Norwegian
	// column never half-matches an English one -- and where the abbreviations do
	// coincide ("jan", "feb", "mar"), the two orders agree anyway.
	{"lav", "middels", "høy"},
	{"lav", "middels", "høg"},
	{"svært lav", "lav", "middels", "høy", "svært høy"},
	{"svært lav", "lav", "middels", "høg", "svært høg"},
	{"liten", "middels", "stor"},
	{"dårlig", "middels", "god", "svært god", "utmerket"},
	{"aldri", "sjelden", "av og til", "ofte", "alltid"},
	{"aldri", "sjeldan", "av og til", "ofte", "alltid"},
	{"helt uenig", "uenig", "nøytral", "enig", "helt enig"},
	{"heilt ueinig", "ueinig", "nøytral", "einig", "heilt einig"},
	{"ingen", "mild", "moderat", "alvorlig"},
	{"ingen", "mild", "moderat", "alvorleg"},
	{"kald", "lunken", "varm", "het"},
	{"mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"},
	{"måndag", "tysdag", "onsdag", "torsdag", "fredag", "laurdag", "søndag"},
	{"man", "tir", "ons", "tor", "fre", "lør", "søn"},
	{
		"januar", "februar", "mars", "april", "mai", "juni",
		"juli", "august", "september", "oktober", "november", "desember",
	},
	{"jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"},
}

// SuggestCategoryOrder proposes an order for a column's category values.
//
// If every value belongs to one known vocabulary, the values are returned in
// that vocabulary's order. Otherwise they are returned sorted, which is what
// scikit-learn's LabelEncoder would use.
//
// Every value must match for a sequence to be used. A partial match means the
// vocabulary is not the one in play -- a column of {"low", "high", "unknown"}
// is not a low/medium/high scale with a gap, it is a different set of
// categories that happens to share two words.
func SuggestCategoryOrder(values []string) []string {
	unique := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		unique = append(unique, v)
	}

	if len(unique) > 1 {
		for _, sequence := range knownSequences {
			if ordered, ok := orderBySequence(unique, sequence); ok {
				return ordered
			}
		}
	}

	// No known vocabulary matched. Fall back to sorted order, numeric-aware so a
	// column of codes 1..11 is proposed in the order a reader expects (#996).
	sortCategoryValues(unique)
	return unique
}

// orderBySequence sorts values by their position in sequence, reporting false
// unless every value appears in it.
func orderBySequence(values, sequence []string) ([]string, bool) {
	position := make(map[string]int, len(sequence))
	for i, name := range sequence {
		position[name] = i
	}

	ranks := make(map[string]int, len(values))
	for _, value := range values {
		rank, ok := position[strings.ToLower(value)]
		if !ok {
			return nil, false
		}
		ranks[value] = rank
	}

	ordered := make([]string, len(values))
	copy(ordered, values)
	sort.SliceStable(ordered, func(i, j int) bool {
		return ranks[ordered[i]] < ranks[ordered[j]]
	})
	return ordered, true
}
