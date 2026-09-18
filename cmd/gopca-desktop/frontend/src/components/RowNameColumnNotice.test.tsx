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

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RowNameColumnNotice } from './RowNameColumnNotice';

// Issue #969. The defect was silence: a file with no identifier column lost its
// first variable and nothing on screen said which one, or why. These check that
// the panel now says both, and that the correction is reachable.

describe('RowNameColumnNotice', () => {
    const base = {
        hasRowNames: true,
        variableCount: 2,
        canSwitch: true,
        onSwitch: () => {},
        busy: false
    };

    it('names the column that became row names', () => {
        render(<RowNameColumnNotice {...base} rowNamesHeader="Si" />);
        expect(screen.getByText(/Si/)).toBeTruthy();
        expect(screen.getByText(/2 variables in the analysis/)).toBeTruthy();
    });

    it('says the column was unnamed under the blank-header convention', () => {
        render(<RowNameColumnNotice {...base} rowNamesHeader="" />);
        expect(screen.getByText(/unnamed/)).toBeTruthy();
    });

    // A header of nothing but spaces is the blank convention wearing a disguise;
    // rendering it would produce a sentence that trails off into whitespace.
    it('treats a whitespace-only header as unnamed', () => {
        render(<RowNameColumnNotice {...base} rowNamesHeader="   " />);
        expect(screen.getByText(/unnamed/)).toBeTruthy();
    });

    it('reports every column as a variable once the switch is on', () => {
        render(
            <RowNameColumnNotice {...base} hasRowNames={false} variableCount={3} />
        );
        expect(screen.getByText(/all 3 columns are variables/)).toBeTruthy();
        expect(screen.getByText(/labelled by position/)).toBeTruthy();
    });

    it('asks to re-read the file when the switch is turned on', () => {
        const onSwitch = vi.fn();
        render(<RowNameColumnNotice {...base} rowNamesHeader="Si" onSwitch={onSwitch} />);

        fireEvent.click(screen.getByRole('checkbox'));
        expect(onSwitch).toHaveBeenCalledWith(true);
    });

    it('asks to put the row names back when the switch is turned off', () => {
        const onSwitch = vi.fn();
        render(
            <RowNameColumnNotice {...base} hasRowNames={false} variableCount={3} onSwitch={onSwitch} />
        );

        const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
        fireEvent.click(checkbox);
        expect(onSwitch).toHaveBeenCalledWith(false);
    });

    // A built-in sample dataset has no path to re-read, so there is nothing the
    // switch could do. Offering a dead control would be worse than offering none.
    it('offers no switch when the file cannot be re-read', () => {
        render(<RowNameColumnNotice {...base} rowNamesHeader="Si" canSwitch={false} />);
        expect(screen.queryByRole('checkbox')).toBeNull();
        // The statement itself still stands.
        expect(screen.getByText(/Si/)).toBeTruthy();
    });

    it('disables the switch while a re-read is in flight', () => {
        render(<RowNameColumnNotice {...base} rowNamesHeader="Si" busy={true} />);
        expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    });
});
