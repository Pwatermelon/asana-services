
import Pose, {PoseType} from "@/components/pose/pose";
import {useState} from "react";
import {Skeleton} from "@/components/skeleton";

type Props = {
    isLoading: boolean;
    yogaPoses: PoseType[];
    updateList: () => void;
};

export default function YogaPoseList({ isLoading, yogaPoses, updateList }: Props) {
    const groupedPoses = yogaPoses.reduce<Record<string, PoseType[]>>((acc, pose) => {
        const firstLetter = pose.title_russian.charAt(0).toUpperCase();
        if (!acc[firstLetter]) acc[firstLetter] = [];
        acc[firstLetter].push(pose);
        return acc;
    }, {});
    const sortedLetters = Object.keys(groupedPoses).sort();

    const [openGroups, setOpenGroups] = useState<string | null>("А");
    const [activeLetter, setActiveLetter] = useState<string | null>("А");

    const toggleGroup = (letter: string) => {
        setOpenGroups(letter);
        setActiveLetter(letter)
    };
    console.log(groupedPoses)
    return (
        <div className="flex flex-col gap-10 w-11/12 m-auto">
            <div className="flex flex-row flex-wrap gap-6 justify-between">
                {!isLoading
                    ? sortedLetters.map(letter => (
                        <div key={letter} className="mb-2">
                            <button
                                className={`text-xl transition px-5 hover:scale-125 font-bold text-black underline ${activeLetter == letter ? "text-2xl text-red-600 scale-125" : ""}`}
                                onClick={() => toggleGroup(letter)}
                            >
                                {letter}
                            </button>
                        </div>
                    ))
                    :  [...Array(10)].map((_, i) => (
                        <Skeleton key={i} className="w-[10%] lg:w-[2%] aspect-square"/>
                    ))
                }
            </div>
            <div className="text-3xl font-bold text-center bm-5">
                Найденные асаны:
            </div>
            <div className="flex flex-col items-center lg:flex-row  lg:items-stretch justify-around flex-wrap gap-4 cursor-pointer">
                {!isLoading && openGroups
                    ? groupedPoses[openGroups]?.sort((a, b) => a.title_russian.localeCompare(b.title_russian)).map((pose, index: number) => (
                        <div key={index} className="w-full lg:w-1/3">
                            <Pose poseData={pose} clickable={true} updateList={updateList}/>
                        </div>
                    ))
                    :  [...Array(10)].map((_, i) => (
                        <Skeleton key={i}  className="w-[85%] lg:w-[25%] aspect-square p-4 flex flex-col items-center">
                            <Skeleton className="w-[80%] h-[10%] bg-gray-200"/>
                            <Skeleton className="w-[70%] aspect-square bg-gray-200 mt-10"/>
                        </Skeleton>
                    ))
                }
            </div>
        </div>
    );
}