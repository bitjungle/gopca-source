package transform

import (
	"strings"
	"testing"
)

// TestDerivedColumnBaseStripsMarkers covers the stem a derived name is built on.
func TestDerivedColumnBaseStripsMarkers(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"proc_num#category", "proc_num"},
		{"proc_num# category", "proc_num"},
		{"proc_num#CATEGORY", "proc_num"},
		{"Yield#target", "Yield"},
		{"Yield# target", "Yield"},
		{"proc_num", "proc_num"},
		{"Al", "Al"},
		// Not a suffix, so not a marker: uniqueMarkedHeader puts the counter
		// before the marker precisely so this shape does not arise, but a name
		// ending in something else keeps whatever it contains.
		{"Sample_ID#category_2", "Sample_ID#category_2"},
	} {
		if got := derivedColumnBase(tc.in); got != tc.want {
			t.Errorf("derivedColumnBase(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func headersAfterOneHot(t *testing.T, header string, values []string, existing []string) []string {
	t.Helper()
	headers := append([]string{header}, existing...)
	data := make([][]string, len(values))
	for i, v := range values {
		row := make([]string, len(headers))
		row[0] = v
		data[i] = row
	}
	columnTypes := map[string]string{header: "categorical"}
	for _, h := range existing {
		columnTypes[h] = "numeric"
	}
	result := &Result{}
	err := applyOneHot(data, columnTypes, map[string][]string{}, &headers,
		Options{Columns: []string{header}}, result)
	if err != nil {
		t.Fatalf("applyOneHot: %v", err)
	}
	return headers
}

// TestOneHotDropsTheSourceMarker is the reported case: encoding
// proc_num#category gave ten columns each claiming to be a category column,
// when they are the 0/1 features that are meant to enter the analysis (#947).
func TestOneHotDropsTheSourceMarker(t *testing.T) {
	headers := headersAfterOneHot(t, "proc_num#category", []string{"1", "2", "3"}, nil)

	for _, h := range headers[1:] {
		if strings.Contains(h, "#category") {
			t.Errorf("derived column %q carries the source's marker", h)
		}
	}
	want := map[string]bool{"proc_num_1": true, "proc_num_2": true, "proc_num_3": true}
	for _, h := range headers[1:] {
		if !want[h] {
			t.Errorf("unexpected derived column %q", h)
		}
		delete(want, h)
	}
	for h := range want {
		t.Errorf("missing derived column %q", h)
	}

	// The source keeps its own marker: that is what still allows colouring by
	// the category after it has been encoded.
	if headers[0] != "proc_num#category" {
		t.Errorf("source column is now %q, want proc_num#category", headers[0])
	}
}

// TestOneHotDoesNotCollide covers the second fault. Split and ordinal both
// guarded against a name already in use; one-hot appended unchecked, so a file
// already holding the composed name ended up with two columns of it.
func TestOneHotDoesNotCollide(t *testing.T) {
	headers := headersAfterOneHot(t, "proc_num#category", []string{"1", "2"},
		[]string{"proc_num_1"})

	seen := map[string]int{}
	for _, h := range headers {
		seen[h]++
	}
	for h, n := range seen {
		if n > 1 {
			t.Errorf("column %q appears %d times", h, n)
		}
	}
}

// TestSplitDropsTheSourceMarker checks the same rule on the other encoder that
// composes names from a source column.
func TestSplitDropsTheSourceMarker(t *testing.T) {
	headers := []string{"Batch#target"}
	data := [][]string{{"a_b"}, {"c_d"}}
	columnTypes := map[string]string{"Batch#target": "categorical"}
	result := &Result{}
	if err := applySplit(data, columnTypes, map[string][]string{}, &headers,
		Options{Columns: []string{"Batch#target"}, Delimiter: "_"}, result); err != nil {
		t.Fatalf("applySplit: %v", err)
	}
	for _, h := range headers[1:] {
		if strings.Contains(h, "#target") {
			t.Errorf("derived column %q carries the source's marker", h)
		}
	}
}
