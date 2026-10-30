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

import React from 'react';
import { AboutDialog as SharedAboutDialog } from '@gopca/ui-components';
import { Browser } from '../api/backend';
import logo from '../assets/images/GoCSV-logo-1024-transp.png';

interface AboutDialogProps {
    isOpen: boolean;
    onClose: () => void;
    version: string;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose, version }) => {
    const handleHomepageClick = (e: React.MouseEvent) => {
        e.preventDefault();
        Browser.OpenURL('https://bitjungle.github.io/gopca/');
    };

    const handleLicenseClick = (e: React.MouseEvent) => {
        e.preventDefault();
        Browser.OpenURL('https://github.com/bitjungle/gopca/blob/main/LICENSE');
    };

    return (
        <SharedAboutDialog
            isOpen={isOpen}
            onClose={onClose}
            version={version}
            appName="GoCSV Desktop"
            tagline="Data preparation and CSV manipulation tool for GoPCA"
            logoSrc={logo}
            logoAlt="GoCSV Logo"
            onHomepageClick={handleHomepageClick}
            onLicenseClick={handleLicenseClick}
        />
    );
};