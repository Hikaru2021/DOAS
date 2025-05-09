import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "./CSS/LandingPage.css";
import { FaArrowRight, FaArrowLeft, FaBars, FaTimes, FaLeaf, FaShieldAlt, FaSeedling } from "react-icons/fa";

function LandingPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("home");
    const [scrollProgress, setScrollProgress] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        // Function to handle scroll
        const handleScroll = () => {
            // Calculate scroll progress
            const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = (window.pageYOffset / totalHeight) * 100;
            setScrollProgress(progress);

            // Check which section is in view
            const sections = document.querySelectorAll('section');
            sections.forEach(section => {
                const rect = section.getBoundingClientRect();
                const inView = rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2;
                
                if (inView) {
                    setActiveTab(section.id);
                    section.classList.add('visible');
                }
            });
        };

        // Add scroll event listener
        window.addEventListener('scroll', handleScroll);
        
        // Initial check for visible sections
        handleScroll();

        // Cleanup
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Ensure sidebar is closed by default on mobile and when resizing
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsMobileMenuOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        // Initial check
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogin = () => {
        navigate('/login');
    };

    const handleSignup = () => {
        navigate('/signup');
    };

    // Custom arrow components
    function SampleNextArrow(props) {
        const { onClick } = props;
        return (
            <div className="slick-arrow slick-next custom-arrow" onClick={onClick}>
                <div className="nav-circle">
                    <FaArrowRight />
                </div>
            </div>
        );
    }

    function SamplePrevArrow(props) {
        const { onClick } = props;
        return (
            <div className="slick-arrow slick-prev custom-arrow" onClick={onClick}>
                <div className="nav-circle">
                    <FaArrowLeft />
                </div>
            </div>
        );
    }

    // Carousel settings
    const isMobile = window.innerWidth <= 768;
    const settings = {
        dots: true,
        infinite: true,
        speed: 1000,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: isMobile ? 4000 : 5000,
        pauseOnHover: true,
        arrows: !isMobile,
        nextArrow: !isMobile ? <SampleNextArrow /> : undefined,
        prevArrow: !isMobile ? <SamplePrevArrow /> : undefined,
        fade: true,
        cssEase: "ease-in-out",
        adaptiveHeight: false,
        centerMode: false,
        variableWidth: false,
        responsive: [
            {
                breakpoint: 768,
                settings: {
                    arrows: false,
                    dots: true,
                    autoplay: true,
                    autoplaySpeed: 4000
                }
            },
            {
                breakpoint: 480,
                settings: {
                    arrows: false,
                    dots: true,
                    autoplay: true,
                    autoplaySpeed: 3000
                }
            }
        ],
        appendDots: dots => (
            <div className="custom-dots-container">
                <ul className="custom-dots">{dots}</ul>
            </div>
        ),
        customPaging: i => (
            <div className="custom-dot"></div>
        )
    };

    // Tab change handler
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
        // Scroll to the section
        const section = document.getElementById(tab);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <div className="landingpage-body">
            <div className="scroll-progress">
                <div 
                    className="scroll-progress-bar" 
                    style={{ width: `${scrollProgress}%` }}
                />
            </div>
            <div className="MainBody">
                {/* Header Section */}
                <header className="gov-header">
                    <div className="header-container">
                        {/* Logo Section */}
                        <div className="logo-container">
                            <img src="Logo1.png" alt="DENR Logo" className="gov-logo" />
                            <div className="logo-text">
                                <h1>Department of Environment and Natural Resources</h1>
                                <p>Baybay City, Leyte</p>
                            </div>
                        </div>

                        {/* Mobile Menu Toggle */}
                        <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
                            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
                        </button>

                        {/* Navigation Menu */}
                        <nav className={`nav-menu ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
                            <ul className="nav-links">
                                <li><button className={`nav-item ${activeTab === "home" ? "active" : ""}`} onClick={() => handleTabChange("home")}>Home</button></li>
                                <li><button className={`nav-item ${activeTab === "about" ? "active" : ""}`} onClick={() => handleTabChange("about")}>About</button></li>
                                <li><button className={`nav-item ${activeTab === "services" ? "active" : ""}`} onClick={() => handleTabChange("services")}>Services</button></li>
                                <li><button className={`nav-item ${activeTab === "contact" ? "active" : ""}`} onClick={() => handleTabChange("contact")}>Contact Us</button></li>
                            </ul>
                        </nav>

                        {/* Authentication Buttons */}
                        <div className={`auth-buttons ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
                            <button className="login-btn" onClick={() => { handleLogin(); setIsMobileMenuOpen(false); }}>Log In</button>
                            <button className="signup-btn" onClick={() => { handleSignup(); setIsMobileMenuOpen(false); }}>Sign Up</button>
                        </div>
                    </div>
                </header>

                {/* Hero Section with Carousel */}
                <section id="home" className="visible">
                    <div className="hero-section">
                        <Slider {...settings}>
                            <div className="carousel-slide">
                                <div className="slide-overlay"></div>
                                <img src="images/landing1.jpg" alt="Forest Conservation" />
                                <div className="slide-content">
                                    <div className="slide-icon">
                                        <FaLeaf />
                                    </div>
                                    <h2>Protecting Our Natural Resources</h2>
                                    <p>Preserving the Philippines' rich biodiversity for future generations</p>
                                    <div className="slide-cta">
                                        <button className="cta-button" onClick={() => handleTabChange("services")}>
                                            Explore Services <FaArrowRight className="btn-icon" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="carousel-slide">
                                <div className="slide-overlay"></div>
                                <img src="images/landing2.jpg" alt="Environmental Protection" />
                                <div className="slide-content">
                                    <div className="slide-icon">
                                        <FaShieldAlt />
                                    </div>
                                    <h2>Environmental Stewardship</h2>
                                    <p>Committed to sustainable environmental management and conservation</p>
                                    <div className="slide-cta">
                                        <button className="cta-button" onClick={() => handleTabChange("about")}>
                                            Learn More <FaArrowRight className="btn-icon" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="carousel-slide">
                                <div className="slide-overlay"></div>
                                <img src="images/landing3.jpg" alt="Natural Resources" />
                                <div className="slide-content">
                                    <div className="slide-icon">
                                        <FaSeedling />
                                    </div>
                                    <h2>Sustainable Development</h2>
                                    <p>Balancing progress with environmental protection</p>
                                    <div className="slide-cta">
                                        <button className="cta-button" onClick={handleSignup}>
                                            Get Started <FaArrowRight className="btn-icon" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Slider>
                    </div>
                </section>

                {/* Content Sections */}
                <main className="main-container">
                    {/* Home Section */}
                    <section id="home" className={`content ${activeTab === "home" ? "active" : ""}`}>
                        <h1 className="section-title">Welcome to DENR Online Permit System</h1>
                        <div className="features-grid">
                            <div className="feature-card">
                                <h3>Online Application</h3>
                                <p>Submit your permit applications online with ease</p>
                            </div>
                            <div className="feature-card">
                                <h3>Track Status</h3>
                                <p>Monitor your application status in real-time</p>
                            </div>
                            <div className="feature-card">
                                <h3>Quick Processing</h3>
                                <p>Efficient processing of your applications</p>
                            </div>
                        </div>
                    </section>

                    {/* About Section */}
                    <section id="about" className={`content ${activeTab === "about" ? "active" : ""}`}>
                        <h1 className="section-title">About DENR-CENRO Baybay City, Leyte</h1>
                        <div className="about-content">
                            <p>The Department of Environment and Natural Resources - Community Environment and Natural Resources Office (DENR-CENRO) Baybay City, Leyte is responsible for the conservation, management, development, and proper use of the environment and natural resources within its jurisdiction.</p>
                            <div className="mission-vision">
                                <div className="mission">
                                    <h3>Mission</h3>
                                    <p>To mobilize citizenry in protecting, conserving, and managing the environment and natural resources for the present and future generations, in partnership with stakeholders, for a sustainable and healthy environment in Baybay City and nearby municipalities.</p>
                                </div>
                                <div className="vision">
                                    <h3>Vision</h3>
                                    <p>A community enjoying and sustaining its natural resources and a clean, healthy environment for all in Baybay City, Leyte.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Services Section */}
                    <section id="services" className={`content ${activeTab === "services" ? "active" : ""}`}>
                        <h1 className="section-title">Our Services</h1>
                        <div className="services-grid">
                            <div className="service-card">
                                <h3>Environmental Compliance</h3>
                                <p>Environmental Compliance Certificate (ECC) applications and monitoring</p>
                            </div>
                            <div className="service-card">
                                <h3>Forestry Services</h3>
                                <p>Forest land use and timber permit applications</p>
                            </div>
                            <div className="service-card">
                                <h3>Mining Services</h3>
                                <p>Mining permits and clearances</p>
                            </div>
                        </div>
                    </section>

                    {/* Contact Section */}
                    <section id="contact" className={`content ${activeTab === "contact" ? "active" : ""}`}>
                        <h1 className="section-title">Contact Us</h1>
                        <div className="contact-info">
                            <div className="contact-details">
                                <h3>DENR-CENRO Baybay City, Leyte</h3>
                                <p>Brgy. Gaas, Baybay City, Leyte, Philippines 6521</p>
                                <p>Email: cenro.baybay@denr.gov.ph</p>
                                <p>Phone: (053) 563-9123</p>
                            </div>
                            <div className="office-hours">
                                <h3>Office Hours</h3>
                                <p>Monday to Friday: 8:00 AM - 5:00 PM</p>
                                <p>Closed on weekends and holidays</p>
                            </div>
                        </div>
                    </section>
                </main>

                {/* Footer */}
                <footer className="gov-footer">
                    <div className="footer-content">
                        <div className="footer-section">
                            <h3>Quick Links</h3>
                            <ul>
                                <li><button onClick={() => handleTabChange("home")}>Home</button></li>
                                <li><button onClick={() => handleTabChange("about")}>About</button></li>
                                <li><button onClick={() => handleTabChange("services")}>Services</button></li>
                                <li><button onClick={() => handleTabChange("contact")}>Contact</button></li>
                            </ul>
                        </div>
                        <div className="footer-section">
                            <h3>Legal</h3>
                            <ul>
                                <li><a href="#">Privacy Policy</a></li>
                                <li><a href="#">Terms of Service</a></li>
                                <li><a href="#">Accessibility</a></li>
                            </ul>
                        </div>
                        <div className="footer-section">
                            <h3>Connect With Us</h3>
                            <div className="social-links">
                                <a href="#"><i className="fab fa-facebook"></i></a>
                                <a href="#"><i className="fab fa-twitter"></i></a>
                                <a href="#"><i className="fab fa-instagram"></i></a>
                            </div>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>&copy; {new Date().getFullYear()} Department of Environment and Natural Resources. All rights reserved.</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default LandingPage;
