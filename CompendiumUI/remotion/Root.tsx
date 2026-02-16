import React from "react";
import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="DemoVideo"
				component={DemoVideo}
				durationInFrames={53 * 30} // 53 seconds at 30fps
				fps={30}
				width={1280}
				height={720}
				defaultProps={{
					repoName: "Copyright Compendium",
					repoUrl: "https://github.com/adhocteam/copyright-compendium",
				}}
			/>
		</>
	);
};
