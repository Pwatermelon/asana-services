'use client';

const Footer = () => {
    return (
        <footer className="bg-black text-white py-6">
            <div className="max-w-6xl mx-auto px-4 flex flex-col lg:flex-row gap-10 lg:gap-2 justify-center lg:items-center">
                <div className="text-center">
                    <h3 className="text-xl font-bold text-[#F2F2F2]">Контактная информация</h3>
                    <ul className="mt-2 space-y-2 text-sm text-[#F2F2F2]">
                        <li>Email: tyferly2003@gmail.com</li>
                        <li>Телефон: +7 987 357 2114</li>
                    </ul>
                </div>
            </div>
            <div className="text-center mt-6 text-sm text-[#F2F2F2]">
                <p>© 2025. Все права защищены.</p>
            </div>
        </footer>
    );
};

export default Footer;
