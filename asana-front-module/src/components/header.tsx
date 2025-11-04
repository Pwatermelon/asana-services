import Link from "next/link";
import React, {useState} from "react";

const Header: React.FC = () => {
    return (
        <header className="bg-black">
            <nav className="container mx-auto flex justify-end items-center flex-col lg:flex-row">
                <Link href="/about-project" className="text-white text-lg font-bold hover:underline mx-4 py-2 lg:py-4">
                    О проекте
                </Link>
                <Link href="/" className="text-white text-lg font-bold hover:underline mx-4 py-2 lg:py-4">
                    Библиотека асан
                </Link>
                <Link
                    href="/detect-pose"
                    className="text-white text-lg font-bold hover:underline mx-4 py-2 lg:py-4"
                >
                    Определить асану
                </Link>
                <Link
                    href="/profile"
                    className="text-white text-lg font-bold hover:underline py-2 lg:py-4"
                >
                    Личный кабинет
                </Link>
            </nav>
        </header>
    );
};

export default Header;
