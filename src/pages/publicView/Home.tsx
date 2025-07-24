import { useState, useEffect } from 'react';
import { ArrowRight, Star, TrendingUp, Shield, Zap, CheckCircle, Award, Globe, HeartHandshake } from 'lucide-react';
import { useNavigate } from "react-router-dom";


export default function ResellerHomepage() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const navigate = useNavigate();
  

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const benefits = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "High Profit Margins",
      description: "Earn up to 40% commission on every sale with our premium healthcare products"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Trusted Brand",
      description: "Partner with a healthcare brand trusted by thousands of customers worldwide"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Fast Onboarding",
      description: "Get started in 24 hours with our streamlined approval process"
    },
    {
      icon: <HeartHandshake className="w-8 h-8" />,
      title: "Dedicated Support",
      description: "24/7 support team to help you succeed and grow your business"
    }
  ];

  const stats = [
    { number: "500+", label: "Active Resellers" },
    { number: "98%", label: "Satisfaction Rate" },
    { number: "$2M+", label: "Partner Revenue" },
    { number: "50+", label: "Countries" }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Healthcare Reseller",
      content: "Partnering with this company transformed my business. The support is exceptional and the products sell themselves.",
      rating: 5
    },
    {
      name: "Michael Chen",
      role: "Wellness Distributor",
      content: "Best decision I made was becoming a reseller. The commission structure is fair and the brand reputation is outstanding.",
      rating: 5
    },
    {
      name: "Emma Rodriguez",
      role: "Health Product Retailer",
      content: "The onboarding was smooth and the ongoing support helps me hit my targets every month.",
      rating: 5
    }
  ];

  const features = [
    "Exclusive territory rights",
    "Marketing materials provided",
    "Training and certification",
    "Real-time sales dashboard",
    "Flexible payment terms",
    "Product guarantee"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-lavender/10 via-background to-mint/10 font-poppins">

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center bg-gradient-to-r from-lavender/20 to-mint/20 px-4 py-2 rounded-full mb-6">
              <Award className="w-4 h-4 text-lavender mr-2" />
              <span className="text-sm text-muted-foreground">Join 500+ Successful Partners</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-lavender via-blush to-mint bg-clip-text text-transparent leading-tight">
              Become a Healthcare
              <br />
              <span className="text-foreground">Reseller Partner</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Transform your business with our premium healthcare products. Enjoy high margins, dedicated support, and a trusted brand that customers love.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button onClick={() => navigate(`/shop`)} className="bg-gradient-to-r from-lavender to-mint text-white px-8 py-4 rounded-full text-lg font-semibold hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 flex items-center group">
                Our Products
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="border-2 border-lavender text-lavender px-8 py-4 rounded-full text-lg font-semibold hover:bg-lavender hover:text-white transition-all duration-300">
                Learn More
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center group">
                  <div className="text-3xl md:text-4xl font-bold text-lavender mb-2 group-hover:scale-110 transition-transform">
                    {stat.number}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 bg-gradient-to-r from-lavender/5 to-mint/5">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Why Partner With Us?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join a network of successful resellers and unlock your business potential
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-card/50 backdrop-blur-sm p-8 rounded-2xl border border-border hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group">
                <div className="text-lavender mb-4 group-hover:scale-110 transition-transform">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">{benefit.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Simple 3-Step Process
            </h2>
            <p className="text-xl text-muted-foreground">
              Get started as a reseller in just 24 hours
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { step: "01", title: "Apply Online", desc: "Fill out our simple application form with your business details" },
              { step: "02", title: "Get Approved", desc: "Our team reviews and approves qualified partners within 24 hours" },
              { step: "03", title: "Start Selling", desc: "Access your dashboard, products, and start earning immediately" }
            ].map((item, index) => (
              <div key={index} className="text-center relative">
                <div className="w-20 h-20 bg-gradient-to-r from-lavender to-mint rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold shadow-lg">
                  {item.step}
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-foreground">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                {index < 2 && (
                  <ArrowRight className="hidden md:block absolute top-10 -right-4 w-8 h-8 text-lavender/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-gradient-to-r from-mint/5 to-blush/5">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                Everything You Need
                <br />
                <span className="text-lavender">To Succeed</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                We provide all the tools, support, and resources you need to build a thriving reseller business.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-mint flex-shrink-0" />
                    <span className="text-card-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-lavender/20 to-mint/20 rounded-3xl p-8 backdrop-blur-sm border border-border">
                <div className="text-center">
                  <Globe className="w-16 h-16 text-lavender mx-auto mb-6" />
                  <h3 className="text-2xl font-semibold mb-4 text-foreground">Global Opportunity</h3>
                  <p className="text-muted-foreground mb-6">
                    Join resellers in 50+ countries and tap into the growing healthcare market
                  </p>
                  <div className="bg-gradient-to-r from-lavender/10 to-mint/10 rounded-xl p-6">
                    <div className="text-3xl font-bold text-lavender mb-2">$2M+</div>
                    <div className="text-muted-foreground">Total Partner Revenue This Year</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Success Stories
            </h2>
            <p className="text-xl text-muted-foreground">
              Hear from our thriving reseller partners
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lavender to-mint"></div>
              
              <div className="flex flex-col items-center text-center">
                <div className="flex mb-4">
                  {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <blockquote className="text-xl md:text-2xl text-card-foreground mb-6 italic leading-relaxed">
                  "{testimonials[currentTestimonial].content}"
                </blockquote>
                
                <div>
                  <div className="font-semibold text-foreground text-lg">
                    {testimonials[currentTestimonial].name}
                  </div>
                  <div className="text-muted-foreground">
                    {testimonials[currentTestimonial].role}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center mt-6 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonial(index)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentTestimonial ? 'bg-lavender' : 'bg-lavender/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-lavender via-blush to-mint">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Ready to Start Your Journey?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join hundreds of successful resellers and start building your healthcare business today
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button className="bg-white text-lavender px-8 py-4 rounded-full text-lg font-semibold hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 flex items-center group">
              Apply Now - It's Free
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="border-2 border-white text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-white hover:text-lavender transition-all duration-300">
              Schedule a Call
            </button>
          </div>
          
          <p className="text-white/70 mt-6">
            No setup fees • 24-hour approval • Start earning immediately
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-card border-t border-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-lavender to-mint rounded-lg flex items-center justify-center">
                  <HeartHandshake className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-foreground">HealthCare Pro</span>
              </div>
              <p className="text-muted-foreground">
                Empowering healthcare businesses worldwide through innovative partnerships.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Partnership</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-lavender transition-colors">Become a Reseller</a></li>
                <li><a href="#" className="hover:text-lavender transition-colors">Partner Portal</a></li>
                <li><a href="#" className="hover:text-lavender transition-colors">Training Resources</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Support</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-lavender transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-lavender transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-lavender transition-colors">Documentation</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Company</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-lavender transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-lavender transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-lavender transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2025 HealthCare Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}