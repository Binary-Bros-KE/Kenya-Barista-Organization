
"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {applicationReturnPath,authDestination} from "@/lib/auth-destination";
export function AuthJourneyLink({href,children,className}:{href:string;children:React.ReactNode;className?:string}){const [next,setNext]=useState("/dashboard");useEffect(()=>{setNext(applicationReturnPath(new URLSearchParams(window.location.search).get("next")));},[]);return <Link href={authDestination(href,next)} className={className}>{children}</Link>;}
