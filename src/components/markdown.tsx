import React, { memo, PropsWithChildren, useMemo } from "react";
import "katex/dist/katex.min.css";
import Latex from "react-latex-next";
import Marked, { ReactRenderer } from "marked-react";
import { PreBlock } from "./pre-block";
import { isJson, isString } from "lib/utils";
import JsonView from "ui/json-view";
import { LinkIcon } from "lucide-react";

const FadeIn = memo(({ children }: PropsWithChildren) => {
  return <span className="fade-in animate-in duration-1000">{children} </span>;
});
FadeIn.displayName = "FadeIn";

export const WordByWordFadeIn = memo(({ children }: PropsWithChildren) => {
  // Check if children contains LaTeX elements (KaTeX generates elements with specific classes)
  const hasLatex = React.Children.toArray(children).some((child) => {
    if (React.isValidElement(child)) {
      // Check if it's a KaTeX element or Latex component
      const className = (child.props as any)?.className;
      const componentName =
        (child.type as any)?.displayName || (child.type as any)?.name;
      return (
        (className &&
          (className.includes("katex") || className.includes("math"))) ||
        componentName === "Latex"
      );
    }
    return false;
  });

  // If LaTeX is present, render without word-by-word animation to preserve LaTeX structure
  if (hasLatex) {
    return <>{children}</>;
  }

  const childrens = [children]
    .flat()
    .flatMap((child) => (isString(child) ? child.split(" ") : child));

  return (
    <React.Fragment>
      {childrens.map((word, index) => {
        if (isString(word)) {
          return <FadeIn key={`word-${index}-${word}`}>{word}</FadeIn>;
        } else if (React.isValidElement(word)) {
          // Don't split React elements, return them as-is
          return React.cloneElement(word, { key: `element-${index}` });
        } else {
          // For non-React elements that aren't strings, just render them directly
          return <span key={`other-${index}`}>{word}</span>;
        }
      })}
    </React.Fragment>
  );
});
WordByWordFadeIn.displayName = "WordByWordFadeIn";
const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  // Process LaTeX before markdown parsing - following LaTeX.md approach
  const [processedContent, latexBlocks] = useMemo(() => {
    // LaTeX block storage
    const latexBlocks: Array<{
      id: string;
      content: string;
      isBlock: boolean;
    }> = [];
    let modifiedContent = children;

    // Extract block equations first (display math)
    const blockPatterns = [
      { pattern: /\\\[([\s\S]*?)\\\]/g, isBlock: true }, // \[ ... \]
      { pattern: /\$\$([\s\S]*?)\$\$/g, isBlock: true }, // $$ ... $$
    ];

    blockPatterns.forEach(({ pattern, isBlock }) => {
      modifiedContent = modifiedContent.replace(pattern, (match) => {
        const id = `LATEXBLOCK${latexBlocks.length}END`;
        latexBlocks.push({ id, content: match, isBlock });
        return id;
      });
    });

    // Extract inline equations (inline math)
    const inlinePatterns = [
      { pattern: /\\\(([\s\S]*?)\\\)/g, isBlock: false }, // \( ... \)
      { pattern: /\$(?![{#])[^\$\n]+?\$/g, isBlock: false }, // $ ... $
    ];

    inlinePatterns.forEach(({ pattern, isBlock }) => {
      modifiedContent = modifiedContent.replace(pattern, (match) => {
        const id = `LATEXINLINE${latexBlocks.length}END`;
        latexBlocks.push({ id, content: match, isBlock });
        return id;
      });
    });

    return [modifiedContent, latexBlocks];
  }, [children]);

  // Custom renderer for LaTeX integration - following LaTeX.md approach
  const renderer: Partial<ReactRenderer> = {
    text(text: string) {
      // Check if this text contains any LaTeX placeholders
      const blockPattern = /LATEXBLOCK(\d+)END/g;
      const inlinePattern = /LATEXINLINE(\d+)END/g;

      // If no LaTeX placeholders, return text as-is
      if (!blockPattern.test(text) && !inlinePattern.test(text)) {
        return <WordByWordFadeIn>{text}</WordByWordFadeIn>;
      }

      // Reset regex state
      blockPattern.lastIndex = 0;
      inlinePattern.lastIndex = 0;

      // If the entire text is just a single LaTeX placeholder, render it directly
      const singleBlockMatch = text.match(/^LATEXBLOCK(\d+)END$/);
      const singleInlineMatch = text.match(/^LATEXINLINE(\d+)END$/);

      if (singleBlockMatch) {
        const latexBlock = latexBlocks.find((block) => block.id === text);
        if (latexBlock) {
          return (
            <Latex
              delimiters={[
                { left: "$$", right: "$$", display: true },
                { left: "\\[", right: "\\]", display: true },
              ]}
              strict={false}
            >
              {latexBlock.content}
            </Latex>
          );
        }
      }

      if (singleInlineMatch) {
        const latexBlock = latexBlocks.find((block) => block.id === text);
        if (latexBlock) {
          return (
            <Latex
              delimiters={[
                { left: "$", right: "$", display: false },
                { left: "\\(", right: "\\)", display: false },
              ]}
              strict={false}
            >
              {latexBlock.content}
            </Latex>
          );
        }
      }

      // Process mixed content with LaTeX placeholders
      const components: React.ReactNode[] = [];
      let lastEnd = 0;

      // Collect all matches (both block and inline)
      const allMatches: Array<{ match: RegExpExecArray; isBlock: boolean }> =
        [];

      let match;
      while ((match = blockPattern.exec(text)) !== null) {
        allMatches.push({ match, isBlock: true });
      }

      while ((match = inlinePattern.exec(text)) !== null) {
        allMatches.push({ match, isBlock: false });
      }

      // Sort matches by position
      allMatches.sort((a, b) => a.match.index - b.match.index);

      // Process matches in order
      allMatches.forEach(({ match, isBlock }) => {
        const fullMatch = match[0];
        const start = match.index;

        // Add text before this match
        if (start > lastEnd) {
          const textPart = text.slice(lastEnd, start);
          components.push(
            <WordByWordFadeIn
              key={`text-${components.length}-${textPart.slice(0, 10)}`}
            >
              {textPart}
            </WordByWordFadeIn>,
          );
        }

        // Find the corresponding LaTeX block
        const latexBlock = latexBlocks.find((block) => block.id === fullMatch);
        if (latexBlock) {
          if (isBlock) {
            // Block math rendering
            components.push(
              <Latex
                key={`latex-${components.length}`}
                delimiters={[
                  { left: "$$", right: "$$", display: true },
                  { left: "\\[", right: "\\]", display: true },
                ]}
                strict={false}
              >
                {latexBlock.content}
              </Latex>,
            );
          } else {
            // Inline math rendering
            components.push(
              <Latex
                key={`latex-${components.length}`}
                delimiters={[
                  { left: "$", right: "$", display: false },
                  { left: "\\(", right: "\\)", display: false },
                ]}
                strict={false}
              >
                {latexBlock.content}
              </Latex>,
            );
          }
        } else {
          // Fallback if LaTeX block not found
          components.push(
            <WordByWordFadeIn
              key={`fallback-${components.length}-${fullMatch.slice(0, 10)}`}
            >
              {fullMatch}
            </WordByWordFadeIn>,
          );
        }

        lastEnd = start + fullMatch.length;
      });

      // Add remaining text
      if (lastEnd < text.length) {
        const remainingText = text.slice(lastEnd);
        components.push(
          <WordByWordFadeIn
            key={`text-${components.length}-${remainingText.slice(0, 10)}`}
          >
            {remainingText}
          </WordByWordFadeIn>,
        );
      }

      return <span>{components}</span>;
    },

    paragraph(children) {
      // Check if the paragraph contains only a LaTeX block placeholder
      if (typeof children === "string") {
        const blockMatch = children.match(/^LATEXBLOCK(\d+)END$/);
        if (blockMatch) {
          const latexBlock = latexBlocks.find((block) => block.id === children);
          if (latexBlock && latexBlock.isBlock) {
            // Render block equations outside of paragraph tags
            return (
              <div className="my-6 text-center">
                <Latex
                  delimiters={[
                    { left: "$$", right: "$$", display: true },
                    { left: "\\[", right: "\\]", display: true },
                  ]}
                  strict={false}
                >
                  {latexBlock.content}
                </Latex>
              </div>
            );
          }
        }
      }

      // Regular paragraph rendering
      return <p className="leading-6 my-4 break-words">{children}</p>;
    },

    // Other standard markdown elements
    code: (code: string, language?: string) => {
      // Handle code blocks vs inline code
      if (language) {
        // This is a code block with language specified
        // Create a proper React element structure that PreBlock expects
        return (
          <div className="px-4 py-2">
            <PreBlock>
              <code className={`language-${language}`}>{code}</code>
            </PreBlock>
          </div>
        );
      }

      // This is inline code
      return (
        <code className="text-sm rounded-md bg-accent text-primary py-1 px-2 mx-0.5">
          {code}
        </code>
      );
    },

    blockquote: (children: React.ReactNode) => {
      // Check if children contains LaTeX components
      const hasLatexComponent = React.Children.toArray(children).some(
        (child) => {
          if (React.isValidElement(child)) {
            const componentName =
              (child.type as any)?.displayName || (child.type as any)?.name;
            return componentName === "Latex";
          }
          return false;
        },
      );

      return (
        <div className="px-4">
          <blockquote className="relative bg-accent/30 p-6 rounded-2xl my-6 overflow-hidden border">
            {hasLatexComponent ? (
              children
            ) : (
              <WordByWordFadeIn>{children}</WordByWordFadeIn>
            )}
          </blockquote>
        </div>
      );
    },

    list: (children: React.ReactNode[], ordered: boolean) => {
      const Tag = ordered ? "ol" : "ul";
      return (
        <Tag className="px-8 list-decimal list-outside">
          {Array.isArray(children)
            ? children.map((child, index) =>
                React.isValidElement(child) ? (
                  React.cloneElement(child, { key: `list-item-${index}` })
                ) : (
                  <span key={`list-text-${index}`}>{child}</span>
                ),
              )
            : children}
        </Tag>
      );
    },

    listItem: (children: React.ReactNode[]) => {
      // Check if children contains LaTeX components
      const hasLatexComponent = React.Children.toArray(children).some(
        (child) => {
          if (React.isValidElement(child)) {
            const componentName =
              (child.type as any)?.displayName || (child.type as any)?.name;
            return componentName === "Latex";
          }
          return false;
        },
      );

      return (
        <li className="py-2 break-words">
          {hasLatexComponent ? (
            children
          ) : (
            <WordByWordFadeIn>{children}</WordByWordFadeIn>
          )}
        </li>
      );
    },

    strong: (children: React.ReactNode) => {
      // Check if children contains LaTeX components
      const hasLatexComponent = React.Children.toArray(children).some(
        (child) => {
          if (React.isValidElement(child)) {
            const componentName =
              (child.type as any)?.displayName || (child.type as any)?.name;
            return componentName === "Latex";
          }
          return false;
        },
      );

      return (
        <span className="font-semibold">
          {hasLatexComponent ? (
            children
          ) : (
            <WordByWordFadeIn>{children}</WordByWordFadeIn>
          )}
        </span>
      );
    },

    link: (href: string, children: React.ReactNode) => {
      // Check if children contains LaTeX components
      const hasLatexComponent = React.Children.toArray(children).some(
        (child) => {
          if (React.isValidElement(child)) {
            const componentName =
              (child.type as any)?.displayName || (child.type as any)?.name;
            return componentName === "Latex";
          }
          return false;
        },
      );

      return (
        <a
          className="text-primary hover:underline flex gap-1.5 items-center"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          <LinkIcon className="size-3.5" />
          {hasLatexComponent ? (
            children
          ) : (
            <WordByWordFadeIn>{children}</WordByWordFadeIn>
          )}
        </a>
      );
    },

    heading: (children: React.ReactNode, level: number) => {
      const sizeClasses = {
        1: "text-3xl",
        2: "text-2xl",
        3: "text-xl",
        4: "text-lg",
        5: "text-base",
        6: "text-sm",
      };

      const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

      // Check if children contains LaTeX components
      const hasLatexComponent = React.Children.toArray(children).some(
        (child) => {
          if (React.isValidElement(child)) {
            const componentName =
              (child.type as any)?.displayName || (child.type as any)?.name;
            return componentName === "Latex";
          }
          return false;
        },
      );

      return React.createElement(
        HeadingTag,
        {
          className: `${sizeClasses[level as keyof typeof sizeClasses]} font-semibold mt-6 mb-2`,
        },
        hasLatexComponent ? (
          children
        ) : (
          <WordByWordFadeIn>{children}</WordByWordFadeIn>
        ),
      );
    },

    image: (src: string, alt: string) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="mx-auto rounded-lg" src={src} alt={alt} />
    ),

    // Table rendering support
    table: (children: React.ReactNode) => (
      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse border border-border rounded-lg">
          {children}
        </table>
      </div>
    ),

    tableHeader: (children: React.ReactNode) => (
      <thead className="bg-muted/50">{children}</thead>
    ),

    tableBody: (children: React.ReactNode) => <tbody>{children}</tbody>,

    tableRow: (children: React.ReactNode) => (
      <tr className="border-b border-border hover:bg-muted/30 transition-colors">
        {children}
      </tr>
    ),

    tableCell: (children: React.ReactNode[], flags: any) => {
      // Check if children contains LaTeX components
      const hasLatexComponent = React.Children.toArray(children).some(
        (child) => {
          if (React.isValidElement(child)) {
            const componentName =
              (child.type as any)?.displayName || (child.type as any)?.name;
            return componentName === "Latex";
          }
          return false;
        },
      );

      const isHeader = flags?.header || false;
      const Tag = isHeader ? "th" : "td";
      const className = isHeader
        ? "border border-border px-4 py-3 text-left font-semibold bg-muted/30"
        : "border border-border px-4 py-2";

      return React.createElement(
        Tag,
        {
          className,
        },
        hasLatexComponent ? (
          children
        ) : (
          <WordByWordFadeIn>{children}</WordByWordFadeIn>
        ),
      );
    },
  };

  return (
    <article className="w-full h-full relative">
      {isJson(children) ? (
        <JsonView data={children} />
      ) : (
        <div key="markdown-content">
          <Marked renderer={renderer}>{processedContent}</Marked>
        </div>
      )}
    </article>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
