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

package core

import (
	"fmt"
	"math/rand"
	"runtime"
	"testing"
	"time"

	"github.com/bitjungle/gopca/pkg/types"
)

// generateRandomMatrix creates a random matrix for benchmarking
func generateRandomMatrix(rows, cols int) types.Matrix {
	data := make(types.Matrix, rows)
	for i := range data {
		data[i] = make([]float64, cols)
		for j := range data[i] {
			data[i][j] = rand.NormFloat64()
		}
	}
	return data
}

// BenchmarkPCASVD benchmarks SVD method with various matrix sizes
func BenchmarkPCASVD(b *testing.B) {
	sizes := []struct {
		rows int
		cols int
	}{
		{100, 10},
		{1000, 10},
		{1000, 100},
		{5000, 100},
		{10000, 100},
	}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("%dx%d", size.rows, size.cols), func(b *testing.B) {
			data := generateRandomMatrix(size.rows, size.cols)
			config := types.PCAConfig{
				Components:    min(10, size.cols),
				MeanCenter:    true,
				StandardScale: false,
				Method:        "svd",
			}

			engine := NewPCAEngine()
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				_, err := engine.Fit(data, config)
				if err != nil {
					b.Fatalf("PCA failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkPCANIPALS benchmarks NIPALS method with various matrix sizes
func BenchmarkPCANIPALS(b *testing.B) {
	sizes := []struct {
		rows int
		cols int
	}{
		{100, 10},
		{1000, 10},
		{1000, 100},
		{5000, 100},
	}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("%dx%d", size.rows, size.cols), func(b *testing.B) {
			data := generateRandomMatrix(size.rows, size.cols)
			config := types.PCAConfig{
				Components:    min(10, size.cols),
				MeanCenter:    true,
				StandardScale: false,
				Method:        "nipals",
			}

			engine := NewPCAEngine()
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				_, err := engine.Fit(data, config)
				if err != nil {
					b.Fatalf("PCA failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkPCAPreprocessing benchmarks different preprocessing options
func BenchmarkPCAPreprocessing(b *testing.B) {
	data := generateRandomMatrix(1000, 50)

	preprocessingOptions := []struct {
		name          string
		meanCenter    bool
		standardScale bool
	}{
		{"NoPreprocessing", false, false},
		{"MeanCenter", true, false},
		{"Standardize", true, true},
	}

	for _, opt := range preprocessingOptions {
		b.Run(opt.name, func(b *testing.B) {
			config := types.PCAConfig{
				Components:    10,
				MeanCenter:    opt.meanCenter,
				StandardScale: opt.standardScale,
				Method:        "svd",
			}

			engine := NewPCAEngine()
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				_, err := engine.Fit(data, config)
				if err != nil {
					b.Fatalf("PCA failed: %v", err)
				}
			}
		})
	}
}

// TestPCAMemoryUsage tests memory usage for large datasets
func TestPCAMemoryUsage(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping memory usage test in short mode")
	}

	testCases := []struct {
		name string
		rows int
		cols int
	}{
		{"Small", 100, 10},
		{"Medium", 1000, 100},
		{"Large", 5000, 100},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Get initial memory stats
			var m1 runtime.MemStats
			runtime.GC()
			runtime.ReadMemStats(&m1)

			// Generate data and run PCA
			data := generateRandomMatrix(tc.rows, tc.cols)
			config := types.PCAConfig{
				Components:    min(10, tc.cols),
				MeanCenter:    true,
				StandardScale: false,
				Method:        "svd",
			}

			engine := NewPCAEngine()
			result, err := engine.Fit(data, config)
			if err != nil {
				t.Fatalf("PCA failed: %v", err)
			}

			// Get final memory stats
			var m2 runtime.MemStats
			runtime.ReadMemStats(&m2)

			// Calculate memory usage
			memUsed := m2.Alloc - m1.Alloc
			memUsedMB := float64(memUsed) / 1024 / 1024

			// Estimate expected memory usage (rough estimate)
			// Data matrix + scores + loadings + working memory
			dataSize := tc.rows * tc.cols * 8               // 8 bytes per float64
			expectedMB := float64(dataSize*4) / 1024 / 1024 // 4x for all matrices

			t.Logf("Matrix %dx%d: Used %.2f MB (expected ~%.2f MB)",
				tc.rows, tc.cols, memUsedMB, expectedMB)

			// Memory should scale roughly linearly
			if memUsedMB > expectedMB*10 {
				t.Errorf("Excessive memory usage: %.2f MB (expected < %.2f MB)",
					memUsedMB, expectedMB*10)
			}

			// Cleanup
			_ = result
			runtime.GC()
		})
	}
}

// TestPCAPerformanceScaling tests that performance scales appropriately
func TestPCAPerformanceScaling(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance scaling test in short mode")
	}

	// Test that doubling the size roughly doubles the time (or less with optimizations)
	sizes := []struct {
		rows int
		cols int
	}{
		{500, 50},
		{1000, 50},
		{2000, 50},
	}

	times := make([]time.Duration, len(sizes))

	for i, size := range sizes {
		times[i] = fastestFit(t, size.rows, size.cols)
	}

	// Check that the cost does not grow explosively with the row count.
	//
	// With the column count fixed, the time is expected to grow roughly
	// linearly with rows, and the measurements agree -- about 2.0x and 1.7x for
	// each doubling here. The threshold below is set far above that on purpose:
	// this is a smoke test against an accidental change of algorithmic shape,
	// not a performance budget. It should fire when a doubling of the data
	// costs eight times the work, and never when a change makes things 20%
	// slower.
	//
	// The comment here used to say "less than quadratically" four lines above a
	// cubic threshold. Two different claims about the same number, and neither
	// matched what a reader would then measure.
	for i := 1; i < len(times); i++ {
		// A ratio of two measurements is only as good as its denominator, and a
		// sub-millisecond baseline has a relative error large enough to swamp
		// the signal on its own. Skipping is the honest response: the check has
		// nothing to say here, and saying it loudly would be a false alarm.
		if times[i-1] < minimumScalingSample {
			t.Logf("skipping the %dx%d ratio: the %dx%d baseline was %v, too short "+
				"to divide by", sizes[i].rows, sizes[i].cols,
				sizes[i-1].rows, sizes[i-1].cols, times[i-1])
			continue
		}

		ratio := float64(times[i]) / float64(times[i-1])
		sizeRatio := float64(sizes[i].rows) / float64(sizes[i-1].rows)

		// Cubic: one doubling of the data may cost up to eight times the time.
		maxRatio := sizeRatio * sizeRatio * sizeRatio
		if ratio > maxRatio {
			t.Errorf("Performance scaling too poor: time increased by %.2fx for %.2fx size increase "+
				"(%v -> %v, each the fastest of %d runs)",
				ratio, sizeRatio, times[i-1], times[i], performanceRepeats)
		}
	}
}

// performanceRepeats is how many times each size is timed. See fastestFit.
const performanceRepeats = 5

// minimumScalingSample is the shortest measurement whose reciprocal is worth
// trusting. Below it the ratio check is skipped rather than failed.
const minimumScalingSample = time.Millisecond

// fastestFit times one PCA several times and returns the shortest run.
//
// The minimum rather than the mean, because the sources of variation here are
// one-sided: a GC pause, the scheduler, or another job on the same CI runner can
// only ever make a measurement longer than the work actually took. The fastest
// run is therefore the closest estimate of the work, and averaging deliberately
// mixes noise back in.
//
// This matters more than it looks because the caller divides consecutive
// measurements. Noise in the *denominator* is as fatal as in the numerator: an
// unusually fast baseline inflates the next ratio even when every absolute time
// is reasonable. That is how #971 failed on an unrelated pull request -- 500x50
// came in at 7.09ms against a typical 2.8ms, and the 1000x50 ratio blew past a
// threshold that allows cubic growth. The measurements refuted themselves in the
// same log: 2000x50 finished faster than 1000x50.
func fastestFit(t *testing.T, rows, cols int) time.Duration {
	t.Helper()

	data := generateRandomMatrix(rows, cols)
	config := types.PCAConfig{
		Components:    10,
		MeanCenter:    true,
		StandardScale: false,
		Method:        "svd",
	}

	runs := make([]time.Duration, 0, performanceRepeats)
	for run := 0; run < performanceRepeats; run++ {
		engine := NewPCAEngine()
		start := time.Now()
		_, err := engine.Fit(data, config)
		elapsed := time.Since(start)
		if err != nil {
			t.Fatalf("PCA failed for size %dx%d: %v", rows, cols, err)
		}
		runs = append(runs, elapsed)
	}

	fastest := minDuration(runs)
	// Every run is logged, not just the winner: a failure is only diagnosable if
	// the spread is visible, and a wide spread is itself the finding.
	t.Logf("Size %dx%d took %v (fastest of %v)", rows, cols, fastest, runs)
	return fastest
}

// minDuration returns the shortest of the given durations, or zero if there are
// none.
func minDuration(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	fastest := durations[0]
	for _, d := range durations[1:] {
		if d < fastest {
			fastest = d
		}
	}
	return fastest
}

// Issue #971. The guard here is not that a loop can find a minimum -- it is that
// this stays a minimum.
//
// The de-noising rests entirely on taking the fastest run. Replacing it with a
// mean would look like a tidy-up, would keep every test passing, and would
// silently restore the flakiness: an average mixes back in exactly the one-sided
// noise the minimum exists to reject. The mean-vs-minimum case below is the one
// that would fail if someone made that change.
func TestMinDurationTakesTheFastestNotTheAverage(t *testing.T) {
	tests := []struct {
		name string
		runs []time.Duration
		want time.Duration
	}{
		{"single run", []time.Duration{5 * time.Millisecond}, 5 * time.Millisecond},
		{"fastest is last", []time.Duration{9, 7, 3}, 3},
		{"fastest is first", []time.Duration{3, 7, 9}, 3},
		{"no runs at all", nil, 0},
		{
			// The measurements from the CI run that prompted #971, as if they had
			// been repeats of one size rather than one run each of three. Their
			// mean is 54.6ms and their minimum 7.1ms: an average would inherit
			// the outlier that caused the failure.
			name: "one wild outlier among normal runs",
			runs: []time.Duration{
				7089791 * time.Nanosecond,
				91940750 * time.Nanosecond,
				64714334 * time.Nanosecond,
			},
			want: 7089791 * time.Nanosecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := minDuration(tt.runs)
			if got != tt.want {
				t.Errorf("minDuration(%v) = %v, want %v", tt.runs, got, tt.want)
			}
			if len(tt.runs) > 0 {
				var total time.Duration
				for _, d := range tt.runs {
					total += d
				}
				if mean := total / time.Duration(len(tt.runs)); got > mean {
					t.Errorf("minDuration returned %v, which is above the mean %v -- "+
						"this is no longer a minimum", got, mean)
				}
			}
		})
	}
}

// BenchmarkPCAWithWideData benchmarks PCA with wide matrices (more columns than rows)
func BenchmarkPCAWithWideData(b *testing.B) {
	sizes := []struct {
		rows int
		cols int
	}{
		{10, 100},
		{50, 500},
		{100, 1000},
	}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("%dx%d", size.rows, size.cols), func(b *testing.B) {
			data := generateRandomMatrix(size.rows, size.cols)
			config := types.PCAConfig{
				Components:    min(size.rows-1, 10),
				MeanCenter:    true,
				StandardScale: false,
				Method:        "svd",
			}

			engine := NewPCAEngine()
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				_, err := engine.Fit(data, config)
				if err != nil {
					b.Fatalf("PCA failed: %v", err)
				}
			}
		})
	}
}

// TestLargeScaleStress performs stress testing with large matrices
func TestLargeScaleStress(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping large scale stress test in short mode")
	}

	testCases := []struct {
		name   string
		rows   int
		cols   int
		method string
	}{
		{"10000x100_SVD", 10000, 100, "svd"},
		{"1000x1000_SVD", 1000, 1000, "svd"},
		{"100x10000_SVD", 100, 10000, "svd"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Set timeout for this test
			timeout := time.After(60 * time.Second)
			done := make(chan bool)

			go func() {
				data := generateRandomMatrix(tc.rows, tc.cols)
				config := types.PCAConfig{
					Components:    min(10, min(tc.rows-1, tc.cols)),
					MeanCenter:    true,
					StandardScale: false,
					Method:        tc.method,
				}

				engine := NewPCAEngine()
				start := time.Now()

				result, err := engine.Fit(data, config)
				elapsed := time.Since(start)

				if err != nil {
					t.Errorf("PCA failed for %s: %v", tc.name, err)
				} else {
					t.Logf("%s completed in %v", tc.name, elapsed)
					// Basic sanity check
					if result.ComponentsComputed == 0 {
						t.Errorf("No components computed for %s", tc.name)
					}
				}

				done <- true
			}()

			select {
			case <-done:
				// Test completed successfully
			case <-timeout:
				t.Errorf("%s timed out after 60 seconds", tc.name)
			}
		})
	}
}
