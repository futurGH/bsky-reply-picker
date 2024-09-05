import { useState } from "react";

function App() {
	const [postUrl, setPostUrl] = useState<string>("");
	const [mustFollow, setMustFollow] = useState<boolean>(false);
	const [mustFollowHandle, setMustFollowHandle] = useState<string>("");
	const [mustLike, setMustLike] = useState<boolean>(false);

	const [selecting, setSelecting] = useState<boolean>(false);
	const [selectedReply, setSelectedReply] = useState<string>("");
	const [error, setError] = useState<string>("");

	const onPickReply = async () => {
		try {
			setSelecting(true);
			if (!postUrl) {
				setError("Post URL is required.");
				return;
			}
			if (mustFollow && !mustFollowHandle) {
				setError("Follow handle is required.");
				return;
			}
			setError("");

			const uri = await bskyUriToAtUri(postUrl).catch(() => {
				setError("Invalid post URL.");
				return "";
			});
			if (!uri) return;

			let thread: any;
			let replies: any[];
			try {
				thread = await fetch(
					"https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri="
						+ encodeURIComponent(uri) + "&depth=1",
				).then((res) => res.json()).then((data) => data.thread);
				replies = thread?.replies;
			} catch {
				setError("Failed to get replies.");
				return;
			}

			if (!thread || !replies) {
				setError("Failed to get replies.");
				return;
			}

			const likes = mustLike ? await getAllLikes(thread.post.uri) : [];

			let selected: string | undefined;
			while (!selected && replies.length > 0) {
				const { index, value: reply } = selectRandom(replies);
				replies.splice(index, 1);

				const replyUri = reply.post.uri;
				const authorDid = reply.post.author.did;
				if (!replyUri || !authorDid) continue;

				if (mustFollow) {
					const handle = mustFollowHandle.replace("@", "");
					const mustFollowDid = await resolveHandle(handle);
					const following = await fetch(
						"https://public.api.bsky.app/xrpc/app.bsky.graph.getRelationships?actor="
							+ authorDid + "&others=" + mustFollowDid,
					).then((res) => res.json()).then((data) =>
						!!data?.relationships?.[0]?.following
					);
					if (!following) continue;
				}

				if (mustLike && !likes.includes(authorDid)) continue;

				selected = replyUri;
			}

			if (selected) setSelectedReply(atUriToBskyUri(selected));
			else setError("No matching replies found.");
		} finally {
			setSelecting(false);
		}
	};

	return (
		<div className="w-1/2 mx-auto px-12 py-16 flex flex-col justify-center items-center">
			<h1 className="text-4xl font-medium text-center text-blue-700">Bluesky Reply Picker</h1>
			<div className="mt-16 flex flex-col items-start">
				<label className="w-full flex flex-row justify-center items-center gap-x-8">
					<span className="text-lg font-medium text-slate-600">Post URL:</span>
					<input
						type="text"
						value={postUrl}
						onChange={(e) => setPostUrl(e.target.value)}
						className="flex-grow border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400 placeholder:text-sm"
						placeholder="https://bsky.app/..."
					/>
				</label>
				<label className="mt-8 flex flex-row justify-center items-center">
					<input
						type="checkbox"
						id="follow"
						name="follow"
						checked={mustFollow}
						onChange={() => setMustFollow(!mustFollow)}
						className="h-4 w-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<span
						className={"text-sm mr-4 ml-4 " + (mustFollow
							? "font-medium text-slate-600"
							: "font-regular text-slate-400")}
					>
						Must follow:
					</span>
					<input
						type="text"
						value={mustFollowHandle}
						disabled={!mustFollow}
						onChange={(e) => setMustFollowHandle(e.target.value)}
						placeholder="@handle.bsky.social"
						className="h-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 placeholder-slate-400 placeholder:text-sm"
					/>
				</label>
				<label className="mt-8 flex flex-row justify-center items-center">
					<input
						type="checkbox"
						id="like"
						name="like"
						checked={mustLike}
						onChange={() => setMustLike(!mustLike)}
						className="h-4 w-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<span className="text-sm mr-4 ml-4 font-medium text-slate-600">
						Must like post
					</span>
				</label>
			</div>
			<button
				className="mt-12 px-8 py-2 bg-blue-700 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-gray-300 text-white font-medium rounded-md"
				disabled={selecting}
				onClick={onPickReply}
			>
				{selecting ? "Selecting..." : "Pick Reply"}
			</button>
			{error ? <p className="mt-4 text-red-500">{error}</p> : null}
			{selectedReply
				? (
					<div className="mt-8">
						<p className="text-lg font-medium text-slate-600">Selected Reply:</p>
						<a
							href={selectedReply}
							target="_blank"
							rel="noreferrer"
							className="text-blue-700 underline"
						>
							{selectedReply}
						</a>
					</div>
				)
				: null}
		</div>
	);
}

export default App;

function selectRandom<T>(arr: T[]): { index: number; value: T } {
	const randomIndex = Math.floor(Math.random() * arr.length);
	return { index: randomIndex, value: arr[randomIndex] };
}

async function resolveHandle(handle: string): Promise<string> {
	try {
		return await fetch(
			"https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=" + handle,
		).then((res) => res.json()).then((data) => data.did);
	} catch () {
		throw new Error("Failed to resolve handle.");
	}
}

async function bskyUriToAtUri(uri: string): Promise<string> {
	const [handle, , rkey] = uri.split("/").slice(-3);
	const did = await resolveHandle(handle);
	return `at://${did}/app.bsky.feed.post/${rkey}`;
}

function atUriToBskyUri(uri: string): string {
	const [did, , rkey] = uri.split("/").slice(-3);

	return `https://bsky.app/profile/${did}/post/${rkey}`;
}

async function getAllLikes(uri: string): Promise<string[]> {
	let cursor = "";
	let likes: string[] = [];
	while (true) {
		const data = await fetch(
			`https://public.api.bsky.app/xrpc/app.bsky.feed.getLikes?uri=${uri}&cursor=${cursor}`,
		).then((res) => res.json());
		likes = likes.concat(data.likes.map((like: any) => like.actor.did));
		if (!data.cursor) break;
		cursor = data.cursor;
	}
	return likes;
}
