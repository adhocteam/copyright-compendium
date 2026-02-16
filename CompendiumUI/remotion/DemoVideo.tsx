import React from "react";
import {
	AbsoluteFill,
	Img,
	Sequence,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	spring,
} from "remotion";

interface DemoVideoProps {
	repoName: string;
	repoUrl: string;
}

// Scene durations in frames (at 30fps)
const OPENING_DURATION = 8 * 30; // 8 seconds
const SCENE_DURATION = 8 * 30; // 8 seconds each
const CLOSING_DURATION = 5 * 30; // 5 seconds

// Color palette – navy/blue theme matching the app
const COLORS = {
	navy: "#1a2b4a",
	darkBlue: "#1b3a5c",
	blue: "#2e6da4",
	lightBlue: "#b3d4fc",
	white: "#ffffff",
	gold: "#f0c040",
	gray: "#e8ecf1",
};

/* ------------------------------------------------------------------ */
/*  Opening Scene                                                      */
/* ------------------------------------------------------------------ */
const OpeningScene: React.FC<{ repoName: string }> = ({ repoName }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const titleScale = spring({ frame, fps, from: 0.7, to: 1, durationInFrames: 30 });
	const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
	const subtitleOpacity = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: "clamp" });
	const lineWidth = interpolate(frame, [15, 45], [0, 400], { extrapolateRight: "clamp" });
	const taglineOpacity = interpolate(frame, [50, 75], [0, 1], { extrapolateRight: "clamp" });
	const bylineOpacity = interpolate(frame, [70, 95], [0, 1], { extrapolateRight: "clamp" });

	return (
		<AbsoluteFill
			style={{
				background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.darkBlue} 50%, ${COLORS.blue} 100%)`,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{/* Decorative circles */}
			<div
				style={{
					position: "absolute",
					top: -80,
					right: -80,
					width: 300,
					height: 300,
					borderRadius: "50%",
					background: "rgba(255,255,255,0.04)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					bottom: -60,
					left: -60,
					width: 220,
					height: 220,
					borderRadius: "50%",
					background: "rgba(255,255,255,0.03)",
				}}
			/>

			<div
				style={{
					opacity: subtitleOpacity,
					color: COLORS.gold,
					fontSize: 22,
					fontWeight: 600,
					letterSpacing: 6,
					textTransform: "uppercase",
					marginBottom: 16,
					fontFamily: "Inter, system-ui, sans-serif",
				}}
			>
				U.S. Copyright Office
			</div>

			<div
				style={{
					opacity: titleOpacity,
					transform: `scale(${titleScale})`,
					color: COLORS.white,
					fontSize: 58,
					fontWeight: 800,
					textAlign: "center",
					fontFamily: "Inter, system-ui, sans-serif",
					lineHeight: 1.15,
					maxWidth: 900,
				}}
			>
				{repoName}
			</div>

			{/* Animated line */}
			<div
				style={{
					width: lineWidth,
					height: 3,
					background: `linear-gradient(90deg, transparent, ${COLORS.gold}, transparent)`,
					marginTop: 20,
					marginBottom: 20,
					borderRadius: 2,
				}}
			/>

			<div
				style={{
					opacity: taglineOpacity,
					color: COLORS.lightBlue,
					fontSize: 24,
					fontWeight: 400,
					textAlign: "center",
					fontFamily: "Inter, system-ui, sans-serif",
					maxWidth: 700,
				}}
			>
				A navigable, searchable web version of the Compendium of Practices
			</div>

			<div
				style={{
					opacity: bylineOpacity,
					color: COLORS.gold,
					fontSize: 18,
					fontWeight: 500,
					textAlign: "center",
					fontFamily: "Inter, system-ui, sans-serif",
					marginTop: 24,
					letterSpacing: 2,
				}}
			>
				by Ad Hoc, LLC
			</div>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/*  Screenshot Scene (reusable)                                        */
/* ------------------------------------------------------------------ */
interface ScreenshotSceneProps {
	src: string;
	label: string;
	caption: string;
}

const ScreenshotScene: React.FC<ScreenshotSceneProps> = ({ src, label, caption }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const imgScale = spring({ frame, fps, from: 0.92, to: 1, durationInFrames: 25 });
	const imgOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
	const labelOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
	const labelX = interpolate(frame, [10, 30], [30, 0], { extrapolateRight: "clamp" });
	const captionOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });

	return (
		<AbsoluteFill
			style={{
				background: COLORS.gray,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: 30,
			}}
		>
			{/* Label badge */}
			<div
				style={{
					position: "absolute",
					top: 24,
					left: 32,
					opacity: labelOpacity,
					transform: `translateX(${labelX}px)`,
					background: COLORS.navy,
					color: COLORS.white,
					fontSize: 16,
					fontWeight: 700,
					padding: "8px 20px",
					borderRadius: 6,
					fontFamily: "Inter, system-ui, sans-serif",
					letterSpacing: 1,
					textTransform: "uppercase",
				}}
			>
				{label}
			</div>

			{/* Screenshot */}
			<div
				style={{
					opacity: imgOpacity,
					transform: `scale(${imgScale})`,
					borderRadius: 12,
					overflow: "hidden",
					boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
					maxWidth: 1100,
					maxHeight: 560,
				}}
			>
				<Img
					src={staticFile(src)}
					style={{ width: "100%", height: "100%", objectFit: "cover" }}
				/>
			</div>

			{/* Caption */}
			<div
				style={{
					opacity: captionOpacity,
					position: "absolute",
					bottom: 24,
					color: COLORS.darkBlue,
					fontSize: 18,
					fontWeight: 500,
					fontFamily: "Inter, system-ui, sans-serif",
					textAlign: "center",
					maxWidth: 800,
				}}
			>
				{caption}
			</div>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/*  Closing Scene                                                      */
/* ------------------------------------------------------------------ */
const ClosingScene: React.FC<{ repoUrl: string }> = ({ repoUrl }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const ctaScale = spring({ frame, fps, from: 0.8, to: 1, durationInFrames: 30 });
	const ctaOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
	const urlOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });
	const bylineOpacity = interpolate(frame, [50, 75], [0, 1], { extrapolateRight: "clamp" });
	const starOpacity = interpolate(frame, [65, 90], [0, 1], { extrapolateRight: "clamp" });

	return (
		<AbsoluteFill
			style={{
				background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.darkBlue} 50%, ${COLORS.blue} 100%)`,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div
				style={{
					opacity: ctaOpacity,
					transform: `scale(${ctaScale})`,
					color: COLORS.white,
					fontSize: 48,
					fontWeight: 800,
					fontFamily: "Inter, system-ui, sans-serif",
					marginBottom: 24,
				}}
			>
				View on GitHub
			</div>

			<div
				style={{
					opacity: urlOpacity,
					color: COLORS.lightBlue,
					fontSize: 22,
					fontWeight: 400,
					fontFamily: "monospace",
					background: "rgba(255,255,255,0.08)",
					padding: "12px 32px",
					borderRadius: 8,
					marginBottom: 24,
				}}
			>
				{repoUrl}
			</div>

			<div
				style={{
					opacity: bylineOpacity,
					color: COLORS.gold,
					fontSize: 20,
					fontWeight: 600,
					fontFamily: "Inter, system-ui, sans-serif",
					marginBottom: 16,
					letterSpacing: 1,
				}}
			>
				by Ad Hoc, LLC
			</div>

			<div
				style={{
					opacity: starOpacity,
					color: COLORS.lightBlue,
					fontSize: 18,
					fontWeight: 500,
					fontFamily: "Inter, system-ui, sans-serif",
				}}
			>
				⭐ Star the repo to stay updated
			</div>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/*  Main DemoVideo Composition                                         */
/* ------------------------------------------------------------------ */
export const DemoVideo: React.FC<DemoVideoProps> = ({ repoName, repoUrl }) => {
	// Named scene offsets
	const scene1Start = 0;
	const scene2Start = OPENING_DURATION;
	const scene3Start = OPENING_DURATION + SCENE_DURATION;
	const scene4Start = OPENING_DURATION + SCENE_DURATION * 2;
	const scene5Start = OPENING_DURATION + SCENE_DURATION * 3;
	const scene6Start = OPENING_DURATION + SCENE_DURATION * 4;
	const scene7Start = OPENING_DURATION + SCENE_DURATION * 5;

	return (
		<AbsoluteFill style={{ backgroundColor: COLORS.navy }}>
			{/* Scene 1: Opening */}
			<Sequence from={scene1Start} durationInFrames={OPENING_DURATION}>
				<OpeningScene repoName={repoName} />
			</Sequence>

			{/* Scene 2: Section 202 overview */}
			<Sequence from={scene2Start} durationInFrames={SCENE_DURATION}>
				<ScreenshotScene
					src="sec202-base.png"
					label="Section Navigation"
					caption="Navigate to specific sections with the sidebar — Section 202: Purposes and Advantages of Registration"
				/>
			</Sequence>

			{/* Scene 3: Scrolled content with linked terms */}
			<Sequence from={scene3Start} durationInFrames={SCENE_DURATION}>
				<ScreenshotScene
					src="sec202-content.png"
					label="Linked Legal Terms"
					caption="Glossary terms are linked inline — click to view full definitions from the Copyright Act"
				/>
			</Sequence>

			{/* Scene 4: Glossary tooltip popup */}
			<Sequence from={scene4Start} durationInFrames={SCENE_DURATION}>
				<ScreenshotScene
					src="glossary-tooltip.png"
					label="Definition Pop-ups"
					caption="Hover over any linked term to see its legal definition from 17 U.S.C. § 101"
				/>
			</Sequence>

			{/* Scene 5: Translation to Spanish */}
			<Sequence from={scene5Start} durationInFrames={SCENE_DURATION}>
				<ScreenshotScene
					src="translated-spanish.png"
					label="Translation"
					caption="Translate the entire Compendium into Spanish or other languages with built-in AI translation"
				/>
			</Sequence>

			{/* Scene 6: Chapters dropdown */}
			<Sequence from={scene6Start} durationInFrames={SCENE_DURATION}>
				<ScreenshotScene
					src="chapters-menu.png"
					label="Chapters Menu"
					caption="Jump to any chapter instantly with the dropdown — works seamlessly in translated views"
				/>
			</Sequence>

			{/* Scene 7: Closing */}
			<Sequence from={scene7Start} durationInFrames={CLOSING_DURATION}>
				<ClosingScene repoUrl={repoUrl} />
			</Sequence>
		</AbsoluteFill>
	);
};
